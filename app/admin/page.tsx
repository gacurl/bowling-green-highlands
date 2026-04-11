import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function AdminPage() {
  return (
    <PageShell
      eyebrow="Operator Area"
      title="Future operator area."
      description="This page is reserved for farm operators. Future work will add reservation request review and other operator-only tools here, but no admin workflow is live yet."
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Return to landing
        </Link>
      }
    />
  );
}
