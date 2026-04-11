import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function ConfirmationPage() {
  return (
    <PageShell
      eyebrow="Confirmation"
      title="Request submitted placeholder."
      description="This page marks the end of the public placeholder flow. Final confirmation messaging will be refined when request behavior exists."
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Back to landing
        </Link>
      }
    />
  );
}
