import Link from "next/link";
import Image from "next/image";
import { readHomepageContent } from "../lib/content/homepage-content-store";

export default async function Home() {
  const homepageContent = await readHomepageContent();
  const faqItems = homepageContent.faqs.filter(
    (faqItem) => faqItem.question.trim() && faqItem.answer.trim(),
  );
  const reserveHref = homepageContent.primaryCtaHref;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:gap-14 sm:px-6 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-[21/9]">
          <Image
            src="/images/hero-highland-calf-blue-bow.jpg"
            alt="Highland calf standing in the pasture at Bowling Green Highlands."
            fill
            priority
            className="object-cover object-[55%_38%]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 95vw, 1200px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />
        </div>
        <div className="absolute inset-0 flex items-end p-5 sm:p-8 lg:p-10">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E5BA41]">
              Bowling Green Highlands
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Meet the Highland cattle.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-slate-100 sm:text-base sm:leading-7">
              Request a date to visit the farm. We review each request and confirm
              what works.
            </p>
            <Link
              href={reserveHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
            >
              Reserve a Date
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            A small farm visit built around the Highlands
          </h2>
          <p className="text-sm leading-7 text-slate-200 sm:text-base">
            The cattle are the heart of Bowling Green Highlands. You will find open
            pasture, real farm pace, and a visit managed directly by the people
            caring for the animals.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-100">
            <span className="rounded-full border border-[#94A378] px-4 py-2">
              Real Highland cattle
            </span>
            <span className="rounded-full border border-[#94A378] px-4 py-2">
              Owner-managed dates
            </span>
            <span className="rounded-full border border-[#94A378] px-4 py-2">
              Request-based visits
            </span>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/20">
          <Image
            src="/images/about-barn-pasture.jpg"
            alt="Red barn and fenced pasture at Bowling Green Highlands."
            width={2048}
            height={1102}
            className="h-auto w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 500px"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">
          How visits work
        </h2>
        <ol className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-3 sm:gap-4 sm:text-base">
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            1. Pick an available date.
          </li>
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            2. Send your request.
          </li>
          <li className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            3. We confirm what works.
          </li>
        </ol>
      </section>

      <section id="homepage-faq" aria-labelledby="homepage-faq-heading" className="space-y-5">
        <div className="space-y-2">
          <h2 id="homepage-faq-heading" className="text-2xl font-semibold text-white sm:text-3xl">
            Ready to request your date?
          </h2>
          <p className="max-w-2xl text-sm text-slate-200 sm:text-base">
            Choose an available day, send your request, and we will follow up with
            what works for the farm.
          </p>
        </div>
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          {faqItems.length > 0 ? (
            <dl className="space-y-4">
              {faqItems.map((faqItem) => (
                <div key={faqItem.id} className="space-y-1">
                  <dt className="text-sm font-medium text-zinc-900">
                    {faqItem.question}
                  </dt>
                  <dd className="text-sm text-zinc-700">{faqItem.answer}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-zinc-700">
              Visits are request-based and confirmed by the farm after you submit a
              date.
            </p>
          )}
          <Link
            href={reserveHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
          >
            Reserve a Date
          </Link>
        </div>
      </section>
    </main>
  );
}
