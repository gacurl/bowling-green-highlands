import Link from "next/link";
import { PageShell } from "./components/page-shell";

export default function Home() {
  return (
    <PageShell
      eyebrow="Bowling Green Highlands"
      title="Request a farm stay date."
      description="Choose an available date. We’ll follow up to confirm."
      action={
        <Link
          href="/reserve"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
        >
          Request a date
        </Link>
      }
    />
  );
}
