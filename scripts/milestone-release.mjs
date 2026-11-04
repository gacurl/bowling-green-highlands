import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const RELEASE_ENVIRONMENT = "milestone-release";
export const PRODUCTION_ENVIRONMENT = "Production";
export const VERCEL_BOT_LOGIN = "vercel[bot]";
export const VERCEL_STATUS_CONTEXT = "Vercel";

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export class MilestoneReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = "MilestoneReleaseError";
  }
}

export class GitHubApiError extends MilestoneReleaseError {
  constructor(operation, status) {
    super(`GitHub API request failed during ${operation} with status ${status}`);
    this.name = "GitHubApiError";
    this.operation = operation;
    this.status = status;
  }
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new MilestoneReleaseError(message);
  }
}

function encodePath(value) {
  return encodeURIComponent(value);
}

function latestByDate(items) {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left.created_at ?? "") || 0;
    const rightDate = Date.parse(right.created_at ?? "") || 0;
    return rightDate - leftDate;
  });
}

function validateDeploymentUrl(value) {
  requireCondition(
    typeof value === "string" && value.length > 0 && !/[\r\n]/.test(value),
    "The matching Vercel Production deployment has no safe review URL",
  );

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new MilestoneReleaseError(
      "The matching Vercel Production deployment has an invalid review URL",
    );
  }

  requireCondition(
    parsedUrl.protocol === "https:" &&
      parsedUrl.username === "" &&
      parsedUrl.password === "",
    "The matching Vercel Production deployment review URL must use HTTPS without credentials",
  );

  return value;
}

export async function readVersionState(repositoryRoot = process.cwd()) {
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const packageLock = JSON.parse(
    await readFile(path.join(repositoryRoot, "package-lock.json"), "utf8"),
  );

  return {
    packageVersion: packageJson.version,
    lockVersion: packageLock.version,
    lockRootVersion: packageLock.packages?.[""]?.version,
  };
}

export function validateReleaseInputs({
  version,
  commitSha,
  gitRef,
  versionState,
}) {
  requireCondition(
    gitRef === "refs/heads/main",
    "Milestone releases must be dispatched from the main branch",
  );
  requireCondition(
    typeof version === "string" && SEMANTIC_VERSION_PATTERN.test(version),
    "Version must be an exact stable Semantic Version in X.Y.Z form",
  );
  requireCondition(
    typeof commitSha === "string" && COMMIT_SHA_PATTERN.test(commitSha),
    "Commit SHA must be the full lowercase 40-character SHA",
  );
  requireCondition(
    versionState.packageVersion === version,
    `Requested version ${version} does not match package.json version ${versionState.packageVersion}`,
  );
  requireCondition(
    versionState.lockVersion === version &&
      versionState.lockRootVersion === version,
    "package-lock.json version fields must agree with package.json",
  );

  return {
    tagName: `v${version}`,
    version,
    commitSha,
  };
}

export function validateReleaseEnvironment(environment) {
  requireCondition(
    environment?.name === RELEASE_ENVIRONMENT,
    `GitHub environment ${RELEASE_ENVIRONMENT} is not configured`,
  );

  const reviewerRule = environment.protection_rules?.find(
    (rule) => rule.type === "required_reviewers",
  );

  requireCondition(
    reviewerRule &&
      Array.isArray(reviewerRule.reviewers) &&
      reviewerRule.reviewers.length > 0,
    `GitHub environment ${RELEASE_ENVIRONMENT} must support and configure at least one required reviewer`,
  );
  requireCondition(
    environment.deployment_branch_policy?.protected_branches === true,
    `GitHub environment ${RELEASE_ENVIRONMENT} must allow protected branches only`,
  );

  return {
    preventSelfReview: reviewerRule.prevent_self_review === true,
    reviewerCount: reviewerRule.reviewers.length,
  };
}

export function selectSuccessfulVercelDeployment({
  deployments,
  deploymentStatuses,
  commitStatus,
  commitSha,
}) {
  const matchingDeployments = latestByDate(
    deployments.filter(
      (deployment) =>
        deployment.sha === commitSha &&
        deployment.ref === commitSha &&
        deployment.environment === PRODUCTION_ENVIRONMENT &&
        deployment.creator?.login === VERCEL_BOT_LOGIN,
    ),
  );

  requireCondition(
    matchingDeployments.length > 0,
    "No Vercel Production deployment exists for the exact main commit",
  );

  const deployment = matchingDeployments[0];
  const statuses = latestByDate(deploymentStatuses);
  const latestStatus = statuses[0];

  requireCondition(
    latestStatus?.state === "success" &&
      latestStatus.creator?.login === VERCEL_BOT_LOGIN &&
      latestStatus.environment === PRODUCTION_ENVIRONMENT,
    "The latest matching Vercel Production deployment status is not successful",
  );

  const deploymentUrl = validateDeploymentUrl(
    latestStatus.environment_url || latestStatus.target_url || null,
  );

  const vercelStatuses = latestByDate(
    (commitStatus.statuses ?? []).filter(
      (status) => status.context === VERCEL_STATUS_CONTEXT,
    ),
  );
  requireCondition(
    vercelStatuses[0]?.state === "success",
    "The relevant Vercel commit status is not successful",
  );

  return {
    deployment,
    deploymentStatus: latestStatus,
    deploymentUrl,
    commitStatus: vercelStatuses[0],
  };
}

export async function validateMilestoneRelease({
  client,
  version,
  commitSha,
  gitRef,
  versionState,
}) {
  const input = validateReleaseInputs({
    version,
    commitSha,
    gitRef,
    versionState,
  });

  const mainSha = await client.getMainSha();
  requireCondition(
    mainSha === commitSha,
    "Commit SHA must exactly match the current main HEAD",
  );

  const [tagRef, release, environment, deployments, commitStatus] =
    await Promise.all([
      client.getTagRef(input.tagName),
      client.getReleaseByTag(input.tagName),
      client.getEnvironment(RELEASE_ENVIRONMENT),
      client.listDeployments({
        commitSha,
        environment: PRODUCTION_ENVIRONMENT,
      }),
      client.getCommitStatus(commitSha),
    ]);

  requireCondition(
    tagRef === null,
    `Tag ${input.tagName} already exists`,
  );
  requireCondition(
    release === null,
    `GitHub Release ${input.tagName} already exists`,
  );

  const approval = validateReleaseEnvironment(environment);
  const matchingDeployments = latestByDate(
    deployments.filter(
      (deployment) =>
        deployment.sha === commitSha &&
        deployment.ref === commitSha &&
        deployment.environment === PRODUCTION_ENVIRONMENT &&
        deployment.creator?.login === VERCEL_BOT_LOGIN,
    ),
  );

  requireCondition(
    matchingDeployments.length > 0,
    "No Vercel Production deployment exists for the exact main commit",
  );

  const deploymentStatuses = await client.listDeploymentStatuses(
    matchingDeployments[0].id,
  );
  const vercel = selectSuccessfulVercelDeployment({
    deployments,
    deploymentStatuses,
    commitStatus,
    commitSha,
  });

  return {
    ...input,
    approval,
    mainSha,
    ...vercel,
  };
}

async function verifyPublishedMilestone({
  client,
  tagName,
  commitSha,
  expectedTagObjectSha,
}) {
  const [tagRef, release] = await Promise.all([
    client.getTagRef(tagName),
    client.getReleaseByTag(tagName),
  ]);

  requireCondition(tagRef !== null, `Published tag ${tagName} is missing`);
  requireCondition(
    tagRef.object?.type === "tag" &&
      tagRef.object?.sha === expectedTagObjectSha,
    `Published tag ${tagName} is not the annotated tag created by this run`,
  );

  const annotatedTag = await client.getAnnotatedTag(expectedTagObjectSha);
  requireCondition(
    annotatedTag.tag === tagName &&
      annotatedTag.object?.type === "commit" &&
      annotatedTag.object?.sha === commitSha,
    `Annotated tag ${tagName} does not resolve to the approved commit`,
  );
  requireCondition(
    release !== null &&
      release.tag_name === tagName &&
      release.draft === false &&
      release.prerelease === false &&
      typeof release.published_at === "string",
    `GitHub Release ${tagName} was not published for the approved commit`,
  );

  return { annotatedTag, release, tagRef };
}

async function reconcileReleaseFailure({
  client,
  tagName,
  tagObjectSha,
  releaseError,
}) {
  let release;
  try {
    release = await client.getReleaseByTag(tagName);
  } catch {
    throw new MilestoneReleaseError(
      `Release publication returned an error and its final state is ambiguous. The tag was not removed: ${releaseError.message}`,
    );
  }

  if (release !== null) {
    return release;
  }

  let tagRef;
  try {
    tagRef = await client.getTagRef(tagName);
  } catch {
    throw new MilestoneReleaseError(
      `Release publication failed and tag identity could not be confirmed. The tag was not removed: ${releaseError.message}`,
    );
  }

  if (tagRef === null) {
    throw new MilestoneReleaseError(
      `Release publication failed; no release or visible tag remains: ${releaseError.message}`,
    );
  }

  requireCondition(
    tagRef.object?.type === "tag" && tagRef.object?.sha === tagObjectSha,
    `Release publication failed and ${tagName} no longer matches this run. The tag was not removed`,
  );

  await client.deleteTagRef(tagName);
  const remainingTag = await client.getTagRef(tagName);
  requireCondition(
    remainingTag === null,
    `Release publication failed and rollback could not remove ${tagName}`,
  );

  throw new MilestoneReleaseError(
    `Release publication failed; ${tagName} was safely rolled back because no release existed: ${releaseError.message}`,
  );
}

export async function publishMilestoneRelease({
  client,
  version,
  commitSha,
  gitRef,
  versionState,
  tagger,
}) {
  const validation = await validateMilestoneRelease({
    client,
    version,
    commitSha,
    gitRef,
    versionState,
  });

  const tagObject = await client.createAnnotatedTag({
    tagName: validation.tagName,
    commitSha,
    message: `Bowling Green Highlands ${validation.tagName}`,
    tagger,
  });

  requireCondition(
    tagObject.tag === validation.tagName &&
      tagObject.object?.type === "commit" &&
      tagObject.object?.sha === commitSha &&
      typeof tagObject.sha === "string",
    "GitHub did not create the expected annotated tag object",
  );

  try {
    await client.createTagRef({
      tagName: validation.tagName,
      tagObjectSha: tagObject.sha,
    });
  } catch (error) {
    let createdRef;
    try {
      createdRef = await client.getTagRef(validation.tagName);
    } catch {
      throw new MilestoneReleaseError(
        `Tag reference creation returned an error and its final state is ambiguous: ${error.message}`,
      );
    }

    if (
      createdRef?.object?.type !== "tag" ||
      createdRef.object.sha !== tagObject.sha
    ) {
      throw error;
    }
  }

  let release;
  try {
    release = await client.createRelease({
      tagName: validation.tagName,
      commitSha,
      name: `Bowling Green Highlands ${validation.tagName}`,
    });
  } catch (error) {
    release = await reconcileReleaseFailure({
      client,
      tagName: validation.tagName,
      tagObjectSha: tagObject.sha,
      releaseError: error,
    });
  }

  const verified = await verifyPublishedMilestone({
    client,
    tagName: validation.tagName,
    commitSha,
    expectedTagObjectSha: tagObject.sha,
  });

  requireCondition(
    release.id === verified.release.id,
    "Published release identity changed during verification",
  );

  return {
    ...validation,
    ...verified,
  };
}

export function createGitHubClient({
  token,
  repository,
  apiUrl = "https://api.github.com",
  fetchImpl = globalThis.fetch,
}) {
  requireCondition(typeof token === "string" && token.length > 0, "GITHUB_TOKEN is required");
  requireCondition(
    typeof fetchImpl === "function",
    "A Fetch API implementation is required",
  );

  const repositoryParts = repository?.split("/");
  requireCondition(
    repositoryParts?.length === 2 && repositoryParts.every(Boolean),
    "GITHUB_REPOSITORY must be in owner/repository form",
  );

  const [owner, repo] = repositoryParts;
  const repositoryPath = `/repos/${encodePath(owner)}/${encodePath(repo)}`;
  const baseUrl = apiUrl.replace(/\/$/, "");

  async function request(
    pathName,
    { method = "GET", body, allowNotFound = false, operation = pathName } = {},
  ) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${pathName}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "bgh-milestone-release-workflow",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new MilestoneReleaseError(
        `GitHub API request could not complete during ${operation}`,
      );
    }

    if (allowNotFound && response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new GitHubApiError(operation, response.status);
    }
    if (response.status === 204) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      throw new MilestoneReleaseError(
        `GitHub API returned invalid JSON during ${operation}`,
      );
    }
  }

  return {
    async getMainSha() {
      const ref = await request(`${repositoryPath}/git/ref/heads/main`, {
        operation: "main branch lookup",
      });
      return ref.object?.sha;
    },

    getTagRef(tagName) {
      return request(
        `${repositoryPath}/git/ref/tags/${encodePath(tagName)}`,
        { allowNotFound: true, operation: "tag lookup" },
      );
    },

    getAnnotatedTag(tagObjectSha) {
      return request(
        `${repositoryPath}/git/tags/${encodePath(tagObjectSha)}`,
        { operation: "annotated tag verification" },
      );
    },

    getReleaseByTag(tagName) {
      return request(
        `${repositoryPath}/releases/tags/${encodePath(tagName)}`,
        { allowNotFound: true, operation: "release lookup" },
      );
    },

    getEnvironment(environmentName) {
      return request(
        `${repositoryPath}/environments/${encodePath(environmentName)}`,
        {
          allowNotFound: true,
          operation: "release environment protection lookup",
        },
      );
    },

    listDeployments({ commitSha, environment }) {
      const query = new URLSearchParams({
        sha: commitSha,
        environment,
        per_page: "100",
      });
      return request(`${repositoryPath}/deployments?${query}`, {
        operation: "Production deployment lookup",
      });
    },

    listDeploymentStatuses(deploymentId) {
      return request(
        `${repositoryPath}/deployments/${encodePath(String(deploymentId))}/statuses?per_page=100`,
        { operation: "Production deployment status lookup" },
      );
    },

    getCommitStatus(commitSha) {
      return request(
        `${repositoryPath}/commits/${encodePath(commitSha)}/status?per_page=100`,
        { operation: "Vercel commit status lookup" },
      );
    },

    createAnnotatedTag({ tagName, commitSha, message, tagger }) {
      return request(`${repositoryPath}/git/tags`, {
        method: "POST",
        operation: "annotated tag creation",
        body: {
          tag: tagName,
          message,
          object: commitSha,
          type: "commit",
          tagger,
        },
      });
    },

    createTagRef({ tagName, tagObjectSha }) {
      return request(`${repositoryPath}/git/refs`, {
        method: "POST",
        operation: "tag reference publication",
        body: {
          ref: `refs/tags/${tagName}`,
          sha: tagObjectSha,
        },
      });
    },

    createRelease({ tagName, commitSha, name }) {
      return request(`${repositoryPath}/releases`, {
        method: "POST",
        operation: "GitHub Release publication",
        body: {
          tag_name: tagName,
          target_commitish: commitSha,
          name,
          draft: false,
          prerelease: false,
          generate_release_notes: true,
        },
      });
    },

    deleteTagRef(tagName) {
      return request(
        `${repositoryPath}/git/refs/tags/${encodePath(tagName)}`,
        { method: "DELETE", operation: "failed release tag rollback" },
      );
    },
  };
}

function validationSummary(result, mode) {
  return [
    "## Milestone release validation",
    "",
    `- Mode: \`${mode}\``,
    `- Version: \`${result.version}\``,
    `- Tag: \`${result.tagName}\``,
    `- Exact current main commit: \`${result.commitSha}\``,
    `- Vercel Production deployment: \`${result.deployment.id}\``,
    `- Required reviewers configured: \`${result.approval.reviewerCount}\``,
    `- Prevent self-review: \`${result.approval.preventSelfReview}\``,
    "",
    `Review the exact deployment before approving publication: ${result.deploymentUrl}`,
    "",
    "> A successful GitHub/Vercel deployment record does not prove live-domain behavior or successful human smoke testing.",
    "",
  ].join("\n");
}

async function appendWorkflowFile(filePath, content) {
  if (filePath) {
    await appendFile(filePath, content, "utf8");
  }
}

async function runCli() {
  const mode = process.argv[2];
  requireCondition(
    mode === "validate" || mode === "publish",
    "Mode must be validate or publish",
  );

  const version = process.env.RELEASE_VERSION;
  const commitSha = process.env.RELEASE_COMMIT_SHA;
  const gitRef = process.env.GITHUB_REF;
  const versionState = await readVersionState();
  const client = createGitHubClient({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    apiUrl: process.env.GITHUB_API_URL,
  });

  const commonInput = {
    client,
    version,
    commitSha,
    gitRef,
    versionState,
  };
  const result =
    mode === "publish"
      ? await publishMilestoneRelease({
          ...commonInput,
          tagger: {
            name: "github-actions[bot]",
            email: "41898282+github-actions[bot]@users.noreply.github.com",
            date: new Date().toISOString(),
          },
        })
      : await validateMilestoneRelease(commonInput);

  await appendWorkflowFile(
    process.env.GITHUB_OUTPUT,
    [
      `deployment_url=${result.deploymentUrl}`,
      `deployment_id=${result.deployment.id}`,
      `tag_name=${result.tagName}`,
      "",
    ].join("\n"),
  );
  await appendWorkflowFile(
    process.env.GITHUB_STEP_SUMMARY,
    validationSummary(result, mode),
  );

  console.log(
    mode === "publish"
      ? `Published and verified ${result.tagName} at ${result.commitSha}`
      : `Validated ${result.tagName} at ${result.commitSha} without publishing`,
  );
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  runCli().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unknown milestone release failure";
    console.error(`Milestone release failed: ${message}`);
    process.exitCode = 1;
  });
}
