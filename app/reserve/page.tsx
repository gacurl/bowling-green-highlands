import { PageShell } from "../components/page-shell";

type ReservePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ReservePage({ searchParams }: ReservePageProps) {
  const params = await searchParams;
  const hasError = params.error === "1";

  return (
    <PageShell
      eyebrow="Reservation Request"
      title="Send a reservation request for operator review."
      description="Share the request details below. Submitting this form sends the request to the farm operator for review. This does not confirm a booking."
      action={
        <p className="text-sm text-zinc-500">
          The operator reviews requests after the email is sent. No dates are
          confirmed automatically.
        </p>
      }
    >
      <div className="space-y-4">
        {hasError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            The request could not be sent. Check your name, email, and
            preferred date, then try again.
          </p>
        ) : null}
        <form
          action="/reserve/submit"
          method="post"
          className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label
              htmlFor="guestName"
              className="block text-sm font-medium text-zinc-900"
            >
              Name
            </label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              required
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="guestEmail"
              className="block text-sm font-medium text-zinc-900"
            >
              Email
            </label>
            <input
              id="guestEmail"
              name="guestEmail"
              type="email"
              required
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-zinc-900"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              required
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="eventType"
              className="block text-sm font-medium text-zinc-900"
            >
              Event type
            </label>
            <select
              id="eventType"
              name="eventType"
              required
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500"
              defaultValue=""
            >
              <option value="" disabled>
                Select an event type
              </option>
              <option value="farm stay">Farm stay</option>
              <option value="wedding">Wedding</option>
              <option value="retreat">Retreat</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="preferredDate"
              className="block text-sm font-medium text-zinc-900"
            >
              Preferred date
            </label>
            <input
              id="preferredDate"
              name="requestedDates"
              type="date"
              required
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="requestNotes"
              className="block text-sm font-medium text-zinc-900"
            >
              Notes
            </label>
            <textarea
              id="requestNotes"
              name="requestNotes"
              rows={4}
              placeholder="Share anything the operator should know."
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Submit reservation request
          </button>
        </form>
      </div>
    </PageShell>
  );
}
