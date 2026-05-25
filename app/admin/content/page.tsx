import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { readHomepageContent } from "../../../lib/content/homepage-content-store";

type AdminContentPageProps = {
  searchParams?: Promise<{ error?: string; saved?: string }>;
};

export default async function AdminContentPage({
  searchParams,
}: AdminContentPageProps) {
  const content = await readHomepageContent();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const hasSaved = resolvedSearchParams.saved === "1";
  const error = resolvedSearchParams.error;

  return (
    <PageShell
      eyebrow="Operator Area"
      title="Edit homepage content."
      description="Update customer-facing homepage text."
      action={
        <Link
          href="/admin"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 sm:w-auto"
        >
          Back to admin
        </Link>
      }
    >
      <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        {hasSaved ? (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Homepage content saved.
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not save homepage content. Check required fields and CTA link.
          </p>
        ) : null}

        <form action="/admin/content/save" method="post" className="space-y-4">
          <details open className="rounded-2xl border border-zinc-200 bg-zinc-50">
            <summary className="disclosure-summary cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Homepage hero</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <div className="space-y-2">
                <label
                  htmlFor="eyebrow"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Eyebrow
                </label>
                <input
                  id="eyebrow"
                  name="eyebrow"
                  type="text"
                  defaultValue={content.eyebrow}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="headline"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Headline
                </label>
                <input
                  id="headline"
                  name="headline"
                  type="text"
                  defaultValue={content.headline}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="supportingText"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Supporting text
                </label>
                <textarea
                  id="supportingText"
                  name="supportingText"
                  rows={3}
                  defaultValue={content.supportingText}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="primaryCtaLabel"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Primary CTA label
                </label>
                <input
                  id="primaryCtaLabel"
                  name="primaryCtaLabel"
                  type="text"
                  defaultValue={content.primaryCtaLabel}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="primaryCtaHref"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Primary CTA link
                </label>
                <input
                  id="primaryCtaHref"
                  name="primaryCtaHref"
                  type="text"
                  defaultValue={content.primaryCtaHref}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
                <p className="text-sm text-zinc-600">
                  Use an internal path like /reserve.
                </p>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-zinc-200 bg-zinc-50">
            <summary className="disclosure-summary cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Pricing</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <div className="space-y-2">
                <label
                  htmlFor="pricingTitle"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Pricing title
                </label>
                <input
                  id="pricingTitle"
                  name="pricingTitle"
                  type="text"
                  defaultValue={content.pricingTitle}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pricingText"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Pricing text
                </label>
                <textarea
                  id="pricingText"
                  name="pricingText"
                  rows={3}
                  defaultValue={content.pricingText}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-zinc-200 bg-zinc-50">
            <summary className="disclosure-summary cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Policy</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <div className="space-y-2">
                <label
                  htmlFor="policyTitle"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Policy title
                </label>
                <input
                  id="policyTitle"
                  name="policyTitle"
                  type="text"
                  defaultValue={content.policyTitle}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="policyText"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Policy text
                </label>
                <textarea
                  id="policyText"
                  name="policyText"
                  rows={3}
                  defaultValue={content.policyText}
                  required
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                />
              </div>
            </div>
          </details>

          <details className="rounded-2xl border border-zinc-200 bg-zinc-50">
            <summary className="disclosure-summary cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>FAQ</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              {content.faqs.map((faqItem, index) => (
                <div
                  key={faqItem.id}
                  className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <label
                    htmlFor={`faqQuestion${index + 1}`}
                    className="block text-sm font-medium text-zinc-900"
                  >
                    FAQ question {index + 1}
                  </label>
                  <input
                    id={`faqQuestion${index + 1}`}
                    name={`faqQuestion${index + 1}`}
                    type="text"
                    defaultValue={faqItem.question}
                    required
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                  />

                  <label
                    htmlFor={`faqAnswer${index + 1}`}
                    className="block text-sm font-medium text-zinc-900"
                  >
                    FAQ answer {index + 1}
                  </label>
                  <textarea
                    id={`faqAnswer${index + 1}`}
                    name={`faqAnswer${index + 1}`}
                    rows={2}
                    defaultValue={faqItem.answer}
                    required
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </div>
              ))}
            </div>
          </details>

          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 sm:w-auto"
          >
            Save homepage content
          </button>
        </form>
      </article>
    </PageShell>
  );
}
