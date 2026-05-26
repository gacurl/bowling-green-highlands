import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function ContactPage() {
  const contactEmail = process.env.CONTACT_EMAIL?.trim();

  return (
    <PageShell
      eyebrow="Contact"
      title="Questions before you request a date?"
      description="Use the details below to contact the farm, or go straight to Reserve when you are ready."
      actionAfterChildren={false}
      action={
        <Link
          href="/reserve"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
        >
          Reserve
        </Link>
      }
    >
      <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        {contactEmail ? (
          <p className="text-sm text-zinc-700 sm:text-base">
            Email:{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-zinc-900 underline underline-offset-2"
            >
              {contactEmail}
            </a>
          </p>
        ) : (
          <p className="text-sm text-zinc-700 sm:text-base">
            Use the reservation request form and include your question in the notes.
          </p>
        )}
      </section>
    </PageShell>
  );
}
