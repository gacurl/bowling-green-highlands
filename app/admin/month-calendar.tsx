"use client";

import { useState } from "react";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
];
type MonthCalendarProps = {
  todayIso: string;
};

type AvailabilityMode = "unavailable" | "window";
type DayAvailability = {
  mode: AvailabilityMode;
  startTime: string;
  endTime: string;
};

type CalendarCell = {
  dayNumber: number | null;
  isoDate: string | null;
};

const DEFAULT_DAY_AVAILABILITY: DayAvailability = {
  mode: "window",
  startTime: "09:00",
  endTime: "17:00",
};

const INITIAL_DAY_AVAILABILITY: Record<string, DayAvailability> = {
  "2026-04-10": {
    mode: "unavailable",
    startTime: "09:00",
    endTime: "17:00",
  },
  "2026-04-18": {
    mode: "unavailable",
    startTime: "09:00",
    endTime: "17:00",
  },
  "2026-05-03": {
    mode: "window",
    startTime: "10:00",
    endTime: "15:00",
  },
  "2026-05-21": {
    mode: "unavailable",
    startTime: "09:00",
    endTime: "17:00",
  },
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatSelectedDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}

function buildCalendarCells(monthDate: Date): CalendarCell[] {
  const firstDayOfMonth = startOfMonth(monthDate);
  const firstWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ dayNumber: null, isoDate: null });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      dayNumber,
    );

    cells.push({
      dayNumber,
      isoDate: toIsoDate(date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dayNumber: null, isoDate: null });
  }

  return cells;
}

export function MonthCalendar({ todayIso }: MonthCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(() =>
    startOfMonth(new Date(`${todayIso}T00:00:00`)),
  );
  const [dayAvailability, setDayAvailability] = useState(INITIAL_DAY_AVAILABILITY);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const calendarCells = buildCalendarCells(displayMonth);
  const selectedDayAvailability = selectedDate
    ? dayAvailability[selectedDate] ?? DEFAULT_DAY_AVAILABILITY
    : null;

  function updateSelectedDayAvailability(next: Partial<DayAvailability>) {
    if (!selectedDate) {
      return;
    }

    setDayAvailability((current) => {
      const currentValue = current[selectedDate] ?? DEFAULT_DAY_AVAILABILITY;

      return {
        ...current,
        [selectedDate]: {
          ...currentValue,
          ...next,
        },
      };
    });
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setDisplayMonth((current) => addMonths(current, -1))}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900"
          aria-label="Previous month"
        >
          Previous
        </button>
        <h2 className="text-xl font-semibold text-zinc-900">
          {formatMonthLabel(displayMonth)}
        </h2>
        <button
          type="button"
          onClick={() => setDisplayMonth((current) => addMonths(current, 1))}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900"
          aria-label="Next month"
        >
          Next
        </button>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm text-zinc-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-emerald-300 bg-emerald-100" />
          Open
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-zinc-400 bg-zinc-300" />
          Blocked
        </span>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-2" aria-label="Month calendar">
        {WEEKDAY_LABELS.map((weekday) => (
          <div
            key={weekday}
            className="px-2 pb-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-zinc-500"
          >
            {weekday}
          </div>
        ))}
        {calendarCells.map((cell, index) => {
          const isToday = cell.isoDate === todayIso;
          const dayState = cell.isoDate
            ? dayAvailability[cell.isoDate] ?? DEFAULT_DAY_AVAILABILITY
            : null;
          const isBlocked = dayState?.mode === "unavailable";
          const isSelected = cell.isoDate !== null && cell.isoDate === selectedDate;
          const stateLabel = isBlocked ? "Blocked" : "Open";

          return (
            <div
              key={cell.isoDate ?? `empty-${index}`}
              className={`min-h-20 rounded-2xl border px-3 py-3 text-sm ${
                cell.dayNumber === null
                  ? "border-transparent bg-transparent"
                  : isSelected
                    ? "border-zinc-950 ring-2 ring-zinc-950"
                  : isToday
                    ? isBlocked
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-emerald-700 bg-emerald-600 text-white"
                    : isBlocked
                      ? "border-zinc-400 bg-zinc-300 text-zinc-900"
                      : "border-emerald-300 bg-emerald-100 text-zinc-900"
              }`}
              aria-current={isToday ? "date" : undefined}
              aria-label={
                cell.dayNumber !== null
                  ? `${cell.isoDate} ${stateLabel}${isToday ? ", today" : ""}`
                  : undefined
              }
            >
              {cell.dayNumber !== null ? (
                <button
                  type="button"
                  onClick={() => setSelectedDate(cell.isoDate)}
                  className="flex h-full w-full flex-col justify-between text-left"
                >
                  <span className="font-medium">{cell.dayNumber}</span>
                  <span
                    className={`text-xs font-medium ${
                      isToday ? "text-current/80" : "text-current/70"
                    }`}
                  >
                    {stateLabel}
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {selectedDate ? (
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-zinc-900">
                Edit availability
              </h3>
              <p className="text-sm text-zinc-600">
                {formatSelectedDate(selectedDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900"
            >
              Close
            </button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
              <input
                type="radio"
                name="availabilityMode"
                value="unavailable"
                checked={selectedDayAvailability?.mode === "unavailable"}
                onChange={() =>
                  updateSelectedDayAvailability({ mode: "unavailable" })
                }
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="font-medium">Unavailable (full day)</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
              <input
                type="radio"
                name="availabilityMode"
                value="window"
                checked={selectedDayAvailability?.mode === "window"}
                onChange={() => updateSelectedDayAvailability({ mode: "window" })}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="font-medium">Available with time window</span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-zinc-900"
                >
                  Start time
                </label>
                <select
                  id="startTime"
                  value={selectedDayAvailability?.startTime ?? "09:00"}
                  onChange={(event) =>
                    updateSelectedDayAvailability({
                      startTime: event.target.value,
                    })
                  }
                  disabled={selectedDayAvailability?.mode !== "window"}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-zinc-900"
                >
                  End time
                </label>
                <select
                  id="endTime"
                  value={selectedDayAvailability?.endTime ?? "17:00"}
                  onChange={(event) =>
                    updateSelectedDayAvailability({
                      endTime: event.target.value,
                    })
                  }
                  disabled={selectedDayAvailability?.mode !== "window"}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
