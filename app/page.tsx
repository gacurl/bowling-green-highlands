import Link from "next/link";
import { PageShell } from "./components/page-shell";

export default function Home() {
  return (
    <PageShell
      eyebrow="Bowling Green Highlands"
      title="Request a farm stay date."
      description="Choose an available date, send your request, and wait for operator review."
      action={
        <Link
          href="/reserve"
          className="inline-flex items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white"
        >
          Start a reservation request
        </Link>
      }
    />
  );
}
