import { redirect } from "next/navigation";
import { defaultHomepageContent } from "../../../../lib/content/homepage-content";
import { writeHomepageContent } from "../../../../lib/content/homepage-content-store";

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required form field: ${key}`);
  }

  return value.trim();
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
  } catch {
    redirect("/admin/content?error=invalid_content");
  }

  redirect("/admin/content?saved=1");
}
