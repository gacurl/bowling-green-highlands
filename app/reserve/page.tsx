import Link from "next/link";
import { PageShell } from "../components/page-shell";

export default function ReservePage() {
  return (
    <PageShell
      eyebrow="Reservation Request"
      title="Reserve is ready for the request flow."
      description="This page is a placeholder for the reservation request step. Date selection and request details will be added in a later issue."
      action={
        <Link
          href="/confirmation"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Continue to confirmation placeholder
        </Link>
      }
    />
  );
}
