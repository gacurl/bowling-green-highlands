import {
  getDatabase,
  type DatabaseAccess,
} from "../server/database";
import {
  defaultHomepageContent,
  type HomepageFaqItem,
  type HomepageContent,
} from "./homepage-content";

type HomepageContentRow = {
  content: unknown;
};

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

function normalizeHomepageContent(value: unknown): HomepageContent | null {
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

function requireMinLength(value: string, minimumLength: number) {
  return value.trim().length >= minimumLength;
}

export function validateHomepageContent(
  content: HomepageContent,
): HomepageContentValidationError | null {
  if (!requireNonEmpty(content.eyebrow)) return "invalid_eyebrow";
  if (!requireMinLength(content.headline, 3)) return "invalid_headline";
  if (!requireMinLength(content.supportingText, 8)) {
    return "invalid_supporting_text";
  }
  if (!requireMinLength(content.primaryCtaLabel, 3)) {
    return "invalid_primary_cta_label";
  }
  if (
    !requireNonEmpty(content.primaryCtaHref) ||
    !isSafeInternalHref(content.primaryCtaHref)
  ) {
    return "invalid_primary_cta_href";
  }
  if (!requireMinLength(content.pricingTitle, 3)) {
    return "invalid_pricing_title";
  }
  if (!requireMinLength(content.pricingText, 8)) {
    return "invalid_pricing_text";
  }
  if (!requireMinLength(content.policyTitle, 3)) {
    return "invalid_policy_title";
  }
  if (!requireMinLength(content.policyText, 8)) {
    return "invalid_policy_text";
  }
  if (!Array.isArray(content.faqs) || content.faqs.length === 0) {
    return "invalid_faqs";
  }
  if (
    content.faqs.some(
      (faqItem) =>
        !requireNonEmpty(faqItem.question) || !requireNonEmpty(faqItem.answer),
    )
  ) {
    return "invalid_faqs";
  }

  return null;
}

export async function readHomepageContent(
  database?: DatabaseAccess,
): Promise<HomepageContent> {
  const result = await getDatabase(database).query<HomepageContentRow>(`
    SELECT content
    FROM homepage_content
    WHERE singleton = TRUE
  `);
  const content = normalizeHomepageContent(result.rows[0]?.content);

  return content ?? defaultHomepageContent;
}

export async function writeHomepageContent(
  content: HomepageContent,
  database?: DatabaseAccess,
) {
  const validationError = validateHomepageContent(content);

  if (validationError) {
    throw new Error(validationError);
  }

  await getDatabase(database).query(
    `
      INSERT INTO homepage_content (singleton, content)
      VALUES (TRUE, $1::jsonb)
      ON CONFLICT (singleton) DO UPDATE
      SET content = EXCLUDED.content,
          updated_at = CURRENT_TIMESTAMP
    `,
    [JSON.stringify(content)],
  );
}
