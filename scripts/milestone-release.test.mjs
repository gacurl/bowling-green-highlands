import assert from "node:assert/strict";
import test from "node:test";

import {
  MilestoneReleaseError,
  publishMilestoneRelease,
  selectSuccessfulVercelDeployment,
  validateMilestoneRelease,
  validateReleaseEnvironment,
  validateReleaseInputs,
} from "./milestone-release.mjs";

const VERSION = "1.4.2";
const COMMIT_SHA = "2a6cf8663a01c4bc1a0f2aae1bc43ae035a2927e";
const TAG_NAME = `v${VERSION}`;
const TAG_OBJECT_SHA = "1111111111111111111111111111111111111111";

function versionState(overrides = {}) {
  return {
    packageVersion: VERSION,
    lockVersion: VERSION,
    lockRootVersion: VERSION,
    ...overrides,
  };
}

function releaseEnvironment(overrides = {}) {
  return {
    name: "milestone-release",
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [{ type: "User", reviewer: { login: "release-owner" } }],
      },
    ],
    deployment_branch_policy: {
      protected_branches: true,
      custom_branch_policies: false,
    },
    ...overrides,
  };
}

function productionDeployment(overrides = {}) {
  return {
    id: 123,
    sha: COMMIT_SHA,
    ref: COMMIT_SHA,
    environment: "Production",
    creator: { login: "vercel[bot]" },
    created_at: "2026-11-04T22:08:48Z",
    ...overrides,
  };
}

function deploymentStatus(overrides = {}) {
  return {
    state: "success",
    creator: { login: "vercel[bot]" },
    environment: "Production",
    environment_url: "https://example.vercel.app",
    created_at: "2026-11-04T22:08:48Z",
    ...overrides,
  };
}

function combinedCommitStatus(overrides = {}) {
  return {
    state: "success",
    statuses: [
      {
        context: "Vercel",
        state: "success",
        created_at: "2026-11-04T22:08:48Z",
      },
    ],
    ...overrides,
  };
}

function createStatefulClient(overrides = {}) {
  const state = {
    tagRef: null,
    annotatedTag: null,
    release: null,
    writes: [],
  };

  const client = {
    async getMainSha() {
      return COMMIT_SHA;
    },
    async getTagRef() {
      return state.tagRef;
    },
    async getAnnotatedTag() {
      return state.annotatedTag;
    },
    async getReleaseByTag() {
      return state.release;
    },
    async getEnvironment() {
      return releaseEnvironment();
    },
    async listDeployments() {
      return [productionDeployment()];
    },
    async listDeploymentStatuses() {
      return [deploymentStatus()];
    },
    async getCommitStatus() {
      return combinedCommitStatus();
    },
    async createAnnotatedTag({ tagName, commitSha }) {
      state.writes.push("createAnnotatedTag");
      state.annotatedTag = {
        sha: TAG_OBJECT_SHA,
        tag: tagName,
        object: { type: "commit", sha: commitSha },
      };
      return state.annotatedTag;
    },
    async createTagRef({ tagObjectSha }) {
      state.writes.push("createTagRef");
      state.tagRef = {
        ref: `refs/tags/${TAG_NAME}`,
        object: { type: "tag", sha: tagObjectSha },
      };
      return state.tagRef;
    },
    async createRelease({ tagName, commitSha, name }) {
      state.writes.push("createRelease");
      state.release = {
        id: 456,
        tag_name: tagName,
        target_commitish: commitSha,
        name,
        draft: false,
        prerelease: false,
        published_at: "2026-11-04T23:00:00Z",
      };
      return state.release;
    },
    async deleteTagRef() {
      state.writes.push("deleteTagRef");
      state.tagRef = null;
    },
    ...overrides,
  };

  return { client, state };
}

function validationInput(client) {
  return {
    client,
    version: VERSION,
    commitSha: COMMIT_SHA,
    gitRef: "refs/heads/main",
    versionState: versionState(),
  };
}

test("release inputs require main, stable SemVer, full SHA, and version agreement", () => {
  assert.deepEqual(
    validateReleaseInputs({
      version: VERSION,
      commitSha: COMMIT_SHA,
      gitRef: "refs/heads/main",
      versionState: versionState(),
    }),
    { tagName: TAG_NAME, version: VERSION, commitSha: COMMIT_SHA },
  );

  const invalidInputs = [
    { gitRef: "refs/heads/feature" },
    { version: "v1.4.2" },
    { version: "1.4.2-beta.1" },
    { commitSha: COMMIT_SHA.slice(0, 7) },
    { versionState: versionState({ packageVersion: "1.4.1" }) },
    { versionState: versionState({ lockRootVersion: "1.4.1" }) },
  ];

  for (const override of invalidInputs) {
    assert.throws(
      () =>
        validateReleaseInputs({
          version: VERSION,
          commitSha: COMMIT_SHA,
          gitRef: "refs/heads/main",
          versionState: versionState(),
          ...override,
        }),
      MilestoneReleaseError,
    );
  }
});

test("release environment requires reviewers and protected branches", () => {
  assert.deepEqual(validateReleaseEnvironment(releaseEnvironment()), {
    preventSelfReview: true,
    reviewerCount: 1,
  });

  assert.throws(
    () =>
      validateReleaseEnvironment(
        releaseEnvironment({ protection_rules: [] }),
      ),
    /required reviewer/,
  );
  assert.throws(
    () =>
      validateReleaseEnvironment(
        releaseEnvironment({ deployment_branch_policy: null }),
      ),
    /protected branches only/,
  );
});

test("Vercel deployment selection requires exact successful Production records", () => {
  const result = selectSuccessfulVercelDeployment({
    deployments: [productionDeployment()],
    deploymentStatuses: [deploymentStatus()],
    commitStatus: combinedCommitStatus(),
    commitSha: COMMIT_SHA,
  });

  assert.equal(result.deployment.id, 123);
  assert.equal(result.deploymentUrl, "https://example.vercel.app");

  assert.throws(
    () =>
      selectSuccessfulVercelDeployment({
        deployments: [productionDeployment({ ref: "main" })],
        deploymentStatuses: [deploymentStatus()],
        commitStatus: combinedCommitStatus(),
        commitSha: COMMIT_SHA,
      }),
    /exact main commit/,
  );
  assert.throws(
    () =>
      selectSuccessfulVercelDeployment({
        deployments: [productionDeployment()],
        deploymentStatuses: [deploymentStatus({ state: "failure" })],
        commitStatus: combinedCommitStatus(),
        commitSha: COMMIT_SHA,
      }),
    /not successful/,
  );
  assert.throws(
    () =>
      selectSuccessfulVercelDeployment({
        deployments: [productionDeployment()],
        deploymentStatuses: [deploymentStatus()],
        commitStatus: combinedCommitStatus({ statuses: [] }),
        commitSha: COMMIT_SHA,
      }),
    /commit status is not successful/,
  );
  assert.throws(
    () =>
      selectSuccessfulVercelDeployment({
        deployments: [productionDeployment()],
        deploymentStatuses: [
          deploymentStatus({ environment_url: "https://example.invalid\nforged" }),
        ],
        commitStatus: combinedCommitStatus(),
        commitSha: COMMIT_SHA,
      }),
    /safe review URL/,
  );
});

test("validate mode is read-only and returns the exact deployment", async () => {
  const { client, state } = createStatefulClient();
  const result = await validateMilestoneRelease(validationInput(client));

  assert.equal(result.mainSha, COMMIT_SHA);
  assert.equal(result.tagName, TAG_NAME);
  assert.equal(result.deployment.id, 123);
  assert.deepEqual(state.writes, []);
});

test("validation rejects a commit that is not current main HEAD", async () => {
  const { client } = createStatefulClient({
    async getMainSha() {
      return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    },
  });

  await assert.rejects(
    validateMilestoneRelease(validationInput(client)),
    /current main HEAD/,
  );
});

test("validation rejects an existing tag", async () => {
  const { client } = createStatefulClient({
    async getTagRef() {
      return { ref: `refs/tags/${TAG_NAME}` };
    },
  });

  await assert.rejects(
    validateMilestoneRelease(validationInput(client)),
    /already exists/,
  );
});

test("validation rejects an existing GitHub Release", async () => {
  const { client } = createStatefulClient({
    async getReleaseByTag() {
      return { tag_name: TAG_NAME };
    },
  });

  await assert.rejects(
    validateMilestoneRelease(validationInput(client)),
    /Release .* already exists/,
  );
});

test("validation rejects a missing required-reviewer rule", async () => {
  const { client } = createStatefulClient({
    async getEnvironment() {
      return releaseEnvironment({ protection_rules: [] });
    },
  });

  await assert.rejects(
    validateMilestoneRelease(validationInput(client)),
    /required reviewer/,
  );
});

test("publish revalidates before creating an annotated tag and release", async () => {
  const { client, state } = createStatefulClient();
  const result = await publishMilestoneRelease({
    ...validationInput(client),
    tagger: {
      name: "github-actions[bot]",
      email: "41898282+github-actions[bot]@users.noreply.github.com",
      date: "2026-11-04T23:00:00Z",
    },
  });

  assert.equal(result.annotatedTag.object.sha, COMMIT_SHA);
  assert.equal(result.release.target_commitish, COMMIT_SHA);
  assert.deepEqual(state.writes, [
    "createAnnotatedTag",
    "createTagRef",
    "createRelease",
  ]);
});

test("publish safely removes its exact tag when release creation fails", async () => {
  let state;
  const configured = createStatefulClient({
    async createRelease() {
      state.writes.push("createRelease");
      throw new Error("simulated release failure");
    },
  });
  state = configured.state;

  await assert.rejects(
    publishMilestoneRelease({
      ...validationInput(configured.client),
      tagger: {
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
        date: "2026-11-04T23:00:00Z",
      },
    }),
    /safely rolled back/,
  );

  assert.equal(state.tagRef, null);
  assert.deepEqual(state.writes, [
    "createAnnotatedTag",
    "createTagRef",
    "createRelease",
    "deleteTagRef",
  ]);
});

test("publish does not delete a tag when failed publication state is ambiguous", async () => {
  let releaseLookupCount = 0;
  let state;
  const configured = createStatefulClient({
    async getReleaseByTag() {
      releaseLookupCount += 1;
      if (releaseLookupCount > 1) {
        throw new Error("simulated lookup failure");
      }
      return null;
    },
    async createRelease() {
      state.writes.push("createRelease");
      throw new Error("simulated release failure");
    },
  });
  state = configured.state;

  await assert.rejects(
    publishMilestoneRelease({
      ...validationInput(configured.client),
      tagger: {
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
        date: "2026-11-04T23:00:00Z",
      },
    }),
    /final state is ambiguous/,
  );

  assert.notEqual(state.tagRef, null);
  assert.equal(state.writes.includes("deleteTagRef"), false);
});

test("publish treats a confirmed release as successful after an ambiguous response", async () => {
  let state;
  const configured = createStatefulClient({
    async createRelease({ tagName, commitSha, name }) {
      state.writes.push("createRelease");
      state.release = {
        id: 456,
        tag_name: tagName,
        target_commitish: commitSha,
        name,
        draft: false,
        prerelease: false,
        published_at: "2026-11-04T23:00:00Z",
      };
      throw new Error("simulated lost response");
    },
  });
  state = configured.state;

  const result = await publishMilestoneRelease({
    ...validationInput(configured.client),
    tagger: {
      name: "github-actions[bot]",
      email: "41898282+github-actions[bot]@users.noreply.github.com",
      date: "2026-11-04T23:00:00Z",
    },
  });

  assert.equal(result.release.id, 456);
  assert.equal(state.writes.includes("deleteTagRef"), false);
});
