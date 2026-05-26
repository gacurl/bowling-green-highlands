import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="A working farm hosting request-based stays."
      description="Bowling Green Highlands is a working farm. We review each reservation request before confirming dates so availability stays accurate."
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
        <p className="text-sm text-zinc-700 sm:text-base">
          We keep the process simple: request an available date, then we follow up
          directly. Submitting a request is not an automatic booking confirmation.
        </p>
      </section>
    </PageShell>
  );
}
