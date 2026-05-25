import Link from "next/link";
import { PageShell } from "./components/page-shell";
import { readHomepageContent } from "../lib/content/homepage-content-store";

export default async function Home() {
  const homepageContent = await readHomepageContent();

  return (
    <PageShell
      eyebrow={homepageContent.eyebrow}
      title={homepageContent.headline}
      description={homepageContent.supportingText}
      action={
        <Link
          href={homepageContent.primaryCtaHref}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
        >
          {homepageContent.primaryCtaLabel}
        </Link>
      }
    />
  );
}
