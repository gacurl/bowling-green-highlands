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
            <p className="text-sm text-zinc-600">Use an internal path like /reserve.</p>
          </div>

          <fieldset className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <legend className="px-1 text-sm font-medium text-zinc-900">FAQ items</legend>
            {content.faqs.map((faqItem, index) => (
              <div key={faqItem.id} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4">
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
          </fieldset>

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
