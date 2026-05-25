import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultHomepageContent,
  type HomepageContent,
} from "./homepage-content";

type HomepageContentStoreFile = {
  eyebrow?: unknown;
  headline?: unknown;
  supportingText?: unknown;
  primaryCtaHref?: unknown;
  primaryCtaLabel?: unknown;
};

export type HomepageContentValidationError =
  | "invalid_eyebrow"
  | "invalid_headline"
  | "invalid_supporting_text"
  | "invalid_primary_cta_label"
  | "invalid_primary_cta_href";

function getHomepageContentStorePath() {
  return (
    process.env.BGH_HOMEPAGE_CONTENT_STORE_PATH ??
    path.join(process.cwd(), "data", "homepage-content.json")
  );
}

function normalizeHomepageContent(
  value: unknown,
): HomepageContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as HomepageContentStoreFile;

  if (
    typeof record.eyebrow !== "string" ||
    typeof record.headline !== "string" ||
    typeof record.supportingText !== "string" ||
    typeof record.primaryCtaHref !== "string" ||
    typeof record.primaryCtaLabel !== "string"
  ) {
    return null;
  }

  return {
    eyebrow: record.eyebrow,
    headline: record.headline,
    supportingText: record.supportingText,
    primaryCtaHref: record.primaryCtaHref,
    primaryCtaLabel: record.primaryCtaLabel,
  };
}

function isSafeInternalHref(value: string) {
  return /^\/[a-zA-Z0-9/_-]*$/.test(value);
}

function requireNonEmpty(value: string) {
  return value.trim().length > 0;
}

export function validateHomepageContent(
  content: HomepageContent,
): HomepageContentValidationError | null {
  if (!requireNonEmpty(content.eyebrow)) {
    return "invalid_eyebrow";
  }

  if (!requireNonEmpty(content.headline)) {
    return "invalid_headline";
  }

  if (!requireNonEmpty(content.supportingText)) {
    return "invalid_supporting_text";
  }

  if (!requireNonEmpty(content.primaryCtaLabel)) {
    return "invalid_primary_cta_label";
  }

  if (
    !requireNonEmpty(content.primaryCtaHref) ||
    !isSafeInternalHref(content.primaryCtaHref)
  ) {
    return "invalid_primary_cta_href";
  }

  return null;
}

export async function readHomepageContent(
  storePath = getHomepageContentStorePath(),
): Promise<HomepageContent> {
  try {
    const fileContents = await readFile(storePath, "utf8");
    const parsedContent = JSON.parse(fileContents);
    const content = normalizeHomepageContent(parsedContent);

    return content ?? defaultHomepageContent;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return defaultHomepageContent;
    }

    throw error;
  }
}

export async function writeHomepageContent(
  content: HomepageContent,
  storePath = getHomepageContentStorePath(),
) {
  const validationError = validateHomepageContent(content);

  if (validationError) {
    throw new Error(validationError);
  }

  const directory = path.dirname(storePath);
  const temporaryPath = `${storePath}.tmp`;
  const serializedContent = `${JSON.stringify(content, null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, serializedContent, "utf8");
  await rename(temporaryPath, storePath);
}
