import {
  getReserveExampleSlots,
  RESERVE_EXAMPLE_END_TIME,
  RESERVE_EXAMPLE_START_TIME,
} from "../../lib/reserve-example-availability";
import { formatRequestedSlotValue } from "../../lib/requested-slot";
import { EVENT_TYPE_OPTIONS } from "../lib/event-type";
import { getReserveErrorMessage } from "../lib/operational-error-messages";
import { PageShell } from "../components/page-shell";

export const dynamic = "force-dynamic";

type ReservePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ReservePage({ searchParams }: ReservePageProps) {
  const params = await searchParams;
  const errorMessage = getReserveErrorMessage(params.error);
  const availableSlots = await getReserveExampleSlots();
  const hasSelectableSlots = availableSlots.some(
    (slot) => slot.status === "available",
  );
  const slotsByDate = availableSlots.reduce<Record<string, typeof availableSlots>>(
    (slotsByDateMap, slot) => {
      if (!slotsByDateMap[slot.date]) {
        slotsByDateMap[slot.date] = [];
      }

      slotsByDateMap[slot.date].push(slot);

      return slotsByDateMap;
    },
    {},
  );
  const slotDates = Object.keys(slotsByDate).sort((firstDate, secondDate) =>
    firstDate.localeCompare(secondDate),
  );

  function formatDateLabel(date: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      weekday: "long",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));
  }

  return (
    <PageShell
      eyebrow="Reservation Request"
      title="Check availability, then send a reservation request."
      description="Pick an available date and time, then send your request. This is a request only."
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
                Choose a date and time
              </legend>
              <p className="text-sm text-[#5F604E]">
                Request times are shown for open dates: {RESERVE_EXAMPLE_START_TIME} to{" "}
                {RESERVE_EXAMPLE_END_TIME}.
              </p>
            </div>
            <div className="space-y-3">
              {hasSelectableSlots ? (
                slotDates.map((date) => {
                  const dateSlots = slotsByDate[date] ?? [];

                  return (
                    <fieldset key={date} className="space-y-2">
                      <legend className="text-sm font-medium text-[#4F4B3F]">
                        {formatDateLabel(date)}
                      </legend>
                      {dateSlots.map((slot) => {
                        const isUnavailable = slot.status === "unavailable";
                        const slotValue = formatRequestedSlotValue(slot);

                        if (isUnavailable) {
                          return (
                            <div
                              key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                              className="flex items-center justify-between rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-500"
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
                            className="flex cursor-pointer items-center justify-between rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-stone-900 transition hover:border-green-600 has-[:checked]:border-[#D6A84F] has-[:checked]:bg-green-100"
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="requestedDates"
                                value={slotValue}
                                required
                                className="h-4 w-4 border-green-300 text-[#D6A84F] focus:ring-[#D6A84F]"
                              />
                              <span className="font-medium">
                                {slot.startTime} to {slot.endTime}
                              </span>
                            </span>
                            <span>Available</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  );
                })
              ) : (
                <p
                  id="no-available-slots-note"
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
            disabled={!hasSelectableSlots}
            aria-disabled={!hasSelectableSlots}
            aria-describedby={!hasSelectableSlots ? "no-available-slots-note" : undefined}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-semibold text-[#FFF8EA] transition-colors hover:bg-[#B86748] disabled:bg-stone-300 disabled:text-stone-600 sm:w-auto"
          >
            Submit reservation request
          </button>
        </form>
      </div>
    </PageShell>
  );
}
