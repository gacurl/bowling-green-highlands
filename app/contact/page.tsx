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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
        >
          Reserve
        </Link>
      }
    >
      <section className="rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6">
        {contactEmail ? (
          <p className="text-sm text-[#4F4B3F] sm:text-base">
            Email:{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-[#2F4A35] underline underline-offset-2"
            >
              {contactEmail}
            </a>
          </p>
        ) : (
          <p className="text-sm text-[#4F4B3F] sm:text-base">
            Use the reservation request form and include your question in the notes.
          </p>
        )}
      </section>
    </PageShell>
  );
}
