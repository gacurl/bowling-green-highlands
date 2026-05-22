"use client";

import { useState } from "react";
import type {
  OperatorAvailability,
  OperatorDayAvailability,
  OperatorAvailabilityMode,
} from "../../lib/operator-availability";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MonthCalendarProps = {
  initialAvailability: OperatorAvailability;
  todayIso: string;
};

type CalendarCell = {
  dayNumber: number | null;
  isoDate: string | null;
};

const DEFAULT_DAY_AVAILABILITY: OperatorDayAvailability = {
  mode: "unavailable",
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

export function MonthCalendar({
  initialAvailability,
  todayIso,
}: MonthCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(() =>
    startOfMonth(new Date(`${todayIso}T00:00:00`)),
  );
  const [dayAvailability, setDayAvailability] =
    useState<Record<string, OperatorDayAvailability>>(initialAvailability);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const calendarCells = buildCalendarCells(displayMonth);
  const selectedDayAvailability = selectedDate
    ? dayAvailability[selectedDate] ?? DEFAULT_DAY_AVAILABILITY
    : null;
  const selectedDayStateLabel =
    selectedDayAvailability?.mode === "available" ? "Available" : "Blocked";

  function updateSelectedDayAvailability(mode: OperatorAvailabilityMode) {
    if (!selectedDate) {
      return;
    }

    const dateToUpdate = selectedDate;

    setSaveError(false);

    fetch("/admin/availability", {
      body: JSON.stringify({ date: dateToUpdate, mode }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          setSaveError(true);
          return;
        }

        setDayAvailability((current) => {
          const nextAvailability = { ...current };

          nextAvailability[dateToUpdate] = { mode };

          return nextAvailability;
        });
      })
      .catch(() => setSaveError(true));
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
          Available
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
          const isSelected =
            cell.isoDate !== null && cell.isoDate === selectedDate;
          const stateLabel = isBlocked ? "Blocked" : "Available";

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
                  className="flex h-full w-full items-start text-left"
                >
                  <span className="font-medium">{cell.dayNumber}</span>
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
                Set availability
              </h3>
              <p className="text-sm text-zinc-600">
                {formatSelectedDate(selectedDate)}
              </p>
              <p className="text-sm font-medium text-zinc-800">
                Current: {selectedDayStateLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900"
            >
              Done
            </button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
              <input
                type="radio"
                name="availabilityMode"
                value="unavailable"
                checked={selectedDayAvailability?.mode === "unavailable"}
                onChange={() => updateSelectedDayAvailability("unavailable")}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="font-medium">Blocked (not requestable)</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
              <input
                type="radio"
                name="availabilityMode"
                value="available"
                checked={selectedDayAvailability?.mode === "available"}
                onChange={() => updateSelectedDayAvailability("available")}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="font-medium">Available (requestable)</span>
            </label>
            {saveError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Availability could not be saved. Try the change again.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
