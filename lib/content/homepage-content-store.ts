import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultHomepageContent,
  type HomepageFaqItem,
  type HomepageContent,
} from "./homepage-content";

type HomepageContentStoreFile = {
  eyebrow?: unknown;
  headline?: unknown;
  supportingText?: unknown;
  primaryCtaHref?: unknown;
  primaryCtaLabel?: unknown;
  faqs?: unknown;
  pricingTitle?: unknown;
  pricingText?: unknown;
  policyTitle?: unknown;
  policyText?: unknown;
};

export type HomepageContentValidationError =
  | "invalid_eyebrow"
  | "invalid_headline"
  | "invalid_supporting_text"
  | "invalid_primary_cta_label"
  | "invalid_primary_cta_href"
  | "invalid_faqs"
  | "invalid_pricing_title"
  | "invalid_pricing_text"
  | "invalid_policy_title"
  | "invalid_policy_text";

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
    typeof record.primaryCtaLabel !== "string" ||
    typeof record.pricingTitle !== "string" ||
    typeof record.pricingText !== "string" ||
    typeof record.policyTitle !== "string" ||
    typeof record.policyText !== "string"
  ) {
    return null;
  }

  const normalizedFaqs = normalizeFaqs(record.faqs);

  return {
    eyebrow: record.eyebrow,
    headline: record.headline,
    supportingText: record.supportingText,
    primaryCtaHref: record.primaryCtaHref,
    primaryCtaLabel: record.primaryCtaLabel,
    faqs: normalizedFaqs ?? defaultHomepageContent.faqs,
    pricingTitle: record.pricingTitle,
    pricingText: record.pricingText,
    policyTitle: record.policyTitle,
    policyText: record.policyText,
  };
}

function normalizeFaqs(value: unknown): HomepageFaqItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((faqItem): HomepageFaqItem | null => {
      if (!faqItem || typeof faqItem !== "object" || Array.isArray(faqItem)) {
        return null;
      }

      const record = faqItem as Record<string, unknown>;

      if (
        typeof record.id !== "string" ||
        typeof record.question !== "string" ||
        typeof record.answer !== "string"
      ) {
        return null;
      }

      return {
        id: record.id,
        question: record.question,
        answer: record.answer,
      };
    })
    .filter((faqItem): faqItem is HomepageFaqItem => faqItem !== null);

  return normalized.length > 0 ? normalized : null;
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

  if (!requireNonEmpty(content.pricingTitle)) {
    return "invalid_pricing_title";
  }

  if (!requireNonEmpty(content.pricingText)) {
    return "invalid_pricing_text";
  }

  if (!requireNonEmpty(content.policyTitle)) {
    return "invalid_policy_title";
  }

  if (!requireNonEmpty(content.policyText)) {
    return "invalid_policy_text";
  }

  if (!Array.isArray(content.faqs) || content.faqs.length === 0) {
    return "invalid_faqs";
  }

  const hasInvalidFaq = content.faqs.some((faqItem) => {
    const hasQuestion = requireNonEmpty(faqItem.question);
    const hasAnswer = requireNonEmpty(faqItem.answer);

    return !hasQuestion || !hasAnswer;
  });

  if (hasInvalidFaq) {
    return "invalid_faqs";
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
