import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { readHomepageContent } from "../lib/content/homepage-content-store";

export default async function Home() {
  const homepageContent = await readHomepageContent();
  const faqItems = homepageContent.faqs.filter(
    (faqItem) => faqItem.question.trim() && faqItem.answer.trim(),
  );

  return (
    <PageShell
      eyebrow={homepageContent.eyebrow}
      title={homepageContent.headline}
      description={homepageContent.supportingText}
      actionAfterChildren={false}
      action={
        <Link
          href={homepageContent.primaryCtaHref}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
        >
          {homepageContent.primaryCtaLabel}
        </Link>
      }
    >
      {faqItems.length > 0 ? (
        <section
          aria-labelledby="homepage-faq"
          className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <h2
            id="homepage-faq"
            className="text-lg font-semibold text-zinc-900 sm:text-xl"
          >
            Frequently asked questions
          </h2>
          <dl className="mt-4 space-y-4">
            {faqItems.map((faqItem) => (
              <div key={faqItem.id} className="space-y-1">
                <dt className="text-sm font-medium text-zinc-900">
                  {faqItem.question}
                </dt>
                <dd className="text-sm text-zinc-700">{faqItem.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </PageShell>
  );
}
