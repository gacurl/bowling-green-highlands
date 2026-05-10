import {
  getReserveExampleSlots,
  RESERVE_EXAMPLE_DATE_LABEL,
  RESERVE_EXAMPLE_END_TIME,
  RESERVE_EXAMPLE_START_TIME,
} from "../../lib/reserve-example-availability";
import { PageShell } from "../components/page-shell";

type ReservePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ReservePage({ searchParams }: ReservePageProps) {
  const params = await searchParams;
  const hasError = params.error === "1";
  const availableSlots = await getReserveExampleSlots();
  const hasSelectableSlots = availableSlots.some(
    (slot) => slot.status === "available",
  );

  return (
    <PageShell
      eyebrow="Reservation Request"
      title="Check availability, then send a reservation request."
      description="Current availability is shown below. Submit the form to send your request to the farm operator for review. This does not confirm a booking."
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
            selected time, then try again.
          </p>
        ) : null}
        <form
          action="/reserve/submit"
          method="post"
          className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <fieldset className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-500">
                Example availability
              </p>
              <legend className="text-lg font-semibold text-zinc-900">
                Choose a time
              </legend>
              <p className="text-sm text-zinc-600">
                {RESERVE_EXAMPLE_DATE_LABEL} from {RESERVE_EXAMPLE_START_TIME}{" "}
                to {RESERVE_EXAMPLE_END_TIME}
              </p>
            </div>
            <div className="space-y-3">
              {hasSelectableSlots ? (
                availableSlots.map((slot) => {
                  const isUnavailable = slot.status === "unavailable";
                  const slotValue = `${slot.date} ${slot.startTime} to ${slot.endTime}`;

                  if (isUnavailable) {
                    return (
                      <div
                        key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-500"
                        aria-disabled="true"
                      >
                        <span className="font-medium">
                          {slot.startTime} to {slot.endTime}
                        </span>
                        <span>Unavailable</span>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                      className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 transition hover:border-zinc-500 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="requestedDates"
                          value={slotValue}
                          required
                          className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                        />
                        <span className="font-medium">
                          {slot.startTime} to {slot.endTime}
                        </span>
                      </span>
                      <span>Available</span>
                    </label>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  No availability for this day. Please choose another date or
                  contact us.
                </p>
              )}
            </div>
          </fieldset>
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
            disabled={!hasSelectableSlots}
            aria-disabled={!hasSelectableSlots}
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Submit reservation request
          </button>
        </form>
      </div>
    </PageShell>
  );
}
