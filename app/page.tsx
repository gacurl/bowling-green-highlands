import Link from "next/link";
import { PageShell } from "./components/page-shell";

export default function Home() {
  return (
    <PageShell
      eyebrow="Bowling Green Highlands"
      title="Request a farm stay date."
      description="This is the public reservation request flow for Bowling Green Highlands. Guests request available dates, and operators review those requests separately."
      action={
        <Link
          href="/reserve"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Start a reservation request
        </Link>
      }
    />
  );
}
