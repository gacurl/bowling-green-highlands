import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function AdminPage() {
  return (
    <PageShell
      eyebrow="Operator Area"
      title="Admin route placeholder."
      description="This route is reserved for farm operators. Availability controls and review tools will be added in later issues."
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
