import Link from "next/link";
import Image from "next/image";
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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
        >
          Reserve
        </Link>
      }
    >
      <section className="overflow-hidden rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] shadow-sm">
        <div className="relative aspect-[16/9] w-full">
          <Image
            src="/images/about-barn-pasture.jpg"
            alt="Red barn and fenced pasture at Bowling Green Highlands."
            fill
            className="object-cover object-center"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 960px"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6">
        <p className="text-sm text-[#4F4B3F] sm:text-base">
          We keep the process simple: request an available date, then we follow up
          directly. Submitting a request is not an automatic booking confirmation.
        </p>
      </section>
    </PageShell>
  );
}
