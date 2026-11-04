import {
  getReserveDateOptions,
  PREFERRED_TIME_INCREMENT_MINUTES,
} from "../../lib/reserve-example-availability";
import { EVENT_TYPE_OPTIONS } from "../lib/event-type";
import { getReserveErrorMessage } from "../lib/operational-error-messages";
import { PageShell } from "../components/page-shell";

export const dynamic = "force-dynamic";

type ReservePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTimeLabel(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const hourLabel = hour % 12 || 12;
  const minuteLabel = String(minute).padStart(2, "0");
  const meridiem = hour < 12 ? "AM" : "PM";

  return `${hourLabel}:${minuteLabel} ${meridiem}`;
}

export default async function ReservePage({ searchParams }: ReservePageProps) {
  const params = await searchParams;
  const errorMessage = getReserveErrorMessage(params.error);
  const availableDates = await getReserveDateOptions();
  const hasSelectableDates = availableDates.length > 0;

  return (
    <PageShell
      eyebrow="Reservation Request"
      title="Check availability, then send a reservation request."
      description="Pick an available date and preferred start time, then send your request. This is a request only."
      action={
        <p className="text-sm text-[#5F604E]">
          We review requests and follow up directly.
        </p>
      }
    >
      <div className="space-y-4">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span className="block font-medium">{errorMessage.title}</span>
            <span>{errorMessage.body}</span>
          </p>
        ) : null}
        <form
          action="/reserve/submit"
          method="post"
          className="space-y-5 rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6"
        >
          <fieldset className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#6F745A]">
                Current availability
              </p>
              <legend className="text-lg font-semibold text-[#2B2922]">
                Choose an available date
              </legend>
              <p className="text-sm text-[#5F604E]">
                Each date shows the time window set by Bowling Green Highlands.
              </p>
            </div>
            <div className="space-y-3">
              {hasSelectableDates ? (
                availableDates.map((dateOption) => (
                  <label
                    key={dateOption.date}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-stone-900 transition hover:border-green-600 has-[:checked]:border-[#D6A84F] has-[:checked]:bg-green-100"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="requestedDate"
                        value={dateOption.date}
                        required
                        className="h-4 w-4 border-green-300 text-[#D6A84F] focus:ring-[#D6A84F]"
                      />
                      <span>
                        <span className="block font-medium">
                          {formatDateLabel(dateOption.date)}
                        </span>
                        <span className="block text-[#5F604E]">
                          {formatTimeLabel(dateOption.startMinute)} to{" "}
                          {formatTimeLabel(dateOption.endMinute)}
                        </span>
                      </span>
                    </span>
                    <span>Available</span>
                  </label>
                ))
              ) : (
                <p
                  id="no-available-dates-note"
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600"
                >
                  No dates are currently available to request. Please contact
                  us.
                </p>
              )}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label
              htmlFor="preferredTime"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Preferred start time
            </label>
            <input
              id="preferredTime"
              name="preferredTime"
              type="time"
              step={PREFERRED_TIME_INCREMENT_MINUTES * 60}
              required
              disabled={!hasSelectableDates}
              aria-describedby="preferred-time-note"
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35] disabled:bg-stone-100 disabled:text-stone-500"
            />
            <p id="preferred-time-note" className="text-sm text-[#5F604E]">
              Choose a time within the selected date’s window in 15-minute
              increments.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="guestName"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Name
            </label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="guestEmail"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Email
            </label>
            <input
              id="guestEmail"
              name="guestEmail"
              type="email"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="eventType"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Event type
            </label>
            <select
              id="eventType"
              name="eventType"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition placeholder:text-stone-400 focus:border-[#2F4A35]"
              defaultValue=""
            >
              <option value="" disabled>
                Select an event type
              </option>
              {EVENT_TYPE_OPTIONS.map((eventType) => (
                <option key={eventType.value} value={eventType.value}>
                  {eventType.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="requestNotes"
              className="block text-sm font-medium text-[#2B2922]"
            >
              Notes
            </label>
            <textarea
              id="requestNotes"
              name="requestNotes"
              rows={4}
              placeholder="Share anything we should know."
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition placeholder:text-stone-400 focus:border-[#2F4A35]"
            />
          </div>
          <button
            type="submit"
            disabled={!hasSelectableDates}
            aria-disabled={!hasSelectableDates}
            aria-describedby={
              !hasSelectableDates ? "no-available-dates-note" : undefined
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] disabled:bg-stone-300 disabled:text-stone-600 sm:w-auto"
          >
            Submit reservation request
          </button>
        </form>
      </div>
    </PageShell>
  );
}
