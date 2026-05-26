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
      title="Homepage Content"
      description="Edit what guests read on the homepage, then save."
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
          <p
            role="status"
            className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            Saved. Homepage updates are live now.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            Could not save. Fill every field and use a link like /reserve.
          </p>
        ) : null}

        <form action="/admin/content/save" method="post" className="space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Before you save</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Review each section. Save once when you are done.
            </p>
            <button
              type="submit"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 sm:w-auto"
            >
              Save all homepage changes
            </button>
          </section>

          <details open className="rounded-2xl border border-zinc-200 bg-zinc-50">
            <summary className="disclosure-summary cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Top section guests see first</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-600">
                Controls the headline, short message, and main button.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="eyebrow"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Short top label
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
                  Main headline
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
                  Supporting message
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
                  Main button text
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
                  Main button link
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
              <span>Pricing section</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-600">
                Explains how guests receive pricing after a request.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="pricingTitle"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Section heading
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
                  Section message
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
              <span>Policy section</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-600">
                Sets expectations about review and follow-up.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="policyTitle"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Section heading
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
                  Section message
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
              <span>Frequently asked questions</span>
              <span aria-hidden="true" className="disclosure-chevron">
                ▸
              </span>
            </summary>
            <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-600">
                These answers appear under the homepage details section.
              </p>
              {content.faqs.map((faqItem, index) => (
                <div
                  key={faqItem.id}
                  className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <label
                    htmlFor={`faqQuestion${index + 1}`}
                    className="block text-sm font-medium text-zinc-900"
                  >
                    Question {index + 1}
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
                    Answer {index + 1}
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
            Save all homepage changes
          </button>

        </form>
      </article>
    </PageShell>
  );
}
