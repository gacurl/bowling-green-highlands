import { redirect } from "next/navigation";
import { defaultHomepageContent } from "../../../../lib/content/homepage-content";
import {
  type HomepageContentValidationError,
  writeHomepageContent,
} from "../../../../lib/content/homepage-content-store";

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required form field: ${key}`);
  }

  return value.trim();
}

function toErrorMessage(error: HomepageContentValidationError | "invalid_content") {
  switch (error) {
    case "invalid_eyebrow":
      return "Short top label cannot be blank.";
    case "invalid_headline":
      return "Main headline must be at least 3 characters.";
    case "invalid_supporting_text":
      return "Supporting message must be at least 8 characters.";
    case "invalid_primary_cta_label":
      return "Main button text must be at least 3 characters.";
    case "invalid_primary_cta_href":
      return "Main button link must be an internal path like /reserve.";
    case "invalid_pricing_title":
      return "Pricing section heading must be at least 3 characters.";
    case "invalid_pricing_text":
      return "Pricing section message must be at least 8 characters.";
    case "invalid_policy_title":
      return "Policy section heading must be at least 3 characters.";
    case "invalid_policy_text":
      return "Policy section message must be at least 8 characters.";
    case "invalid_faqs":
      return "Each FAQ needs both a question and an answer.";
    case "invalid_content":
      return "Could not save. Review the form and try again.";
  }
}

function isHomepageContentValidationError(
  value: string,
): value is HomepageContentValidationError {
  return (
    value === "invalid_eyebrow" ||
    value === "invalid_headline" ||
    value === "invalid_supporting_text" ||
    value === "invalid_primary_cta_label" ||
    value === "invalid_primary_cta_href" ||
    value === "invalid_faqs" ||
    value === "invalid_pricing_title" ||
    value === "invalid_pricing_text" ||
    value === "invalid_policy_title" ||
    value === "invalid_policy_text"
  );
}

function redirectWithError(error: HomepageContentValidationError | "invalid_content") {
  const params = new URLSearchParams({ error: toErrorMessage(error) });
  redirect(`/admin/content?${params.toString()}`);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const faqs = defaultHomepageContent.faqs.map((faqItem, index) => ({
      id: faqItem.id,
      question: readRequiredString(formData, `faqQuestion${index + 1}`),
      answer: readRequiredString(formData, `faqAnswer${index + 1}`),
    }));

    await writeHomepageContent({
      eyebrow: readRequiredString(formData, "eyebrow"),
      headline: readRequiredString(formData, "headline"),
      supportingText: readRequiredString(formData, "supportingText"),
      primaryCtaLabel: readRequiredString(formData, "primaryCtaLabel"),
      primaryCtaHref: readRequiredString(formData, "primaryCtaHref"),
      pricingTitle: readRequiredString(formData, "pricingTitle"),
      pricingText: readRequiredString(formData, "pricingText"),
      policyTitle: readRequiredString(formData, "policyTitle"),
      policyText: readRequiredString(formData, "policyText"),
      faqs,
    });
  } catch (error) {
    if (error instanceof Error && isHomepageContentValidationError(error.message)) {
      redirectWithError(error.message);
    }

    redirectWithError("invalid_content");
  }

  redirect("/admin/content?saved=1");
}
