import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { readHomepageContent } from "../../lib/content/homepage-content-store";

export default async function PolicyPage() {
  const homepageContent = await readHomepageContent();

  return (
    <PageShell
      eyebrow="Policy"
      title={homepageContent.policyTitle}
      description={homepageContent.policyText}
      action={
        <Link
          href="/reserve"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
        >
          Request a date
        </Link>
      }
    />
  );
}
