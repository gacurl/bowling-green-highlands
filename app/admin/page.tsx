import Link from "next/link";
import { readOperatorAvailability } from "../../lib/operator-availability";
import { MonthCalendar } from "./month-calendar";
import { PageShell } from "../components/page-shell";

export default async function AdminPage() {
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const initialAvailability = await readOperatorAvailability();

  return (
    <PageShell
      eyebrow="Operator Area"
      title="View the month at a glance."
      description="Use the calendar below to block days that should not be requested publicly."
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Return to landing
        </Link>
      }
    >
      <MonthCalendar
        initialAvailability={initialAvailability}
        todayIso={todayIso}
      />
    </PageShell>
  );
}
