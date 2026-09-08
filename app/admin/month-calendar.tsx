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
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [saveError, setSaveError] = useState(false);
  const calendarCells = buildCalendarCells(displayMonth);
  const selectedCount = selectedDates.length;
  const selectedDateLabel =
    selectedCount === 1 ? formatSelectedDate(selectedDates[0]) : null;
  const selectedDayAvailability = selectedDateLabel
    ? dayAvailability[selectedDates[0]] ?? DEFAULT_DAY_AVAILABILITY
    : null;
  const selectedDayStateLabel =
    selectedDayAvailability?.mode === "available" ? "Available" : "Blocked";

  async function updateSelectedDayAvailability(mode: OperatorAvailabilityMode) {
    if (selectedCount === 0) {
      return;
    }

    const datesToUpdate = [...selectedDates];

    setSaveError(false);

    try {
      for (const dateToUpdate of datesToUpdate) {
        const response = await fetch("/admin/availability", {
          body: JSON.stringify({ date: dateToUpdate, mode }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          setSaveError(true);
          return;
        }
      }

      setDayAvailability((current) => {
        const nextAvailability = { ...current };
        for (const dateToUpdate of datesToUpdate) {
          nextAvailability[dateToUpdate] = { mode };
        }
        return nextAvailability;
      });
    } catch {
      setSaveError(true);
    }
  }

  function toggleSelectedDate(date: string | null) {
    if (!date) {
      return;
    }

    setSelectedDates((current) => {
      if (current.includes(date)) {
        return current.filter((selectedDate) => selectedDate !== date);
      }

      return [...current, date].sort((firstDate, secondDate) =>
        firstDate.localeCompare(secondDate),
      );
    });
  }

  return (
    <section className="rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setDisplayMonth((current) => addMonths(current, -1))}
          className="min-h-11 rounded-full border border-[#CFC3AE] bg-white px-3 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922] sm:px-4"
          aria-label="Previous month"
        >
          Previous
        </button>
        <h2 className="text-center text-base font-semibold text-[#2B2922] sm:text-xl">
          {formatMonthLabel(displayMonth)}
        </h2>
        <button
          type="button"
          onClick={() => setDisplayMonth((current) => addMonths(current, 1))}
          className="min-h-11 rounded-full border border-[#CFC3AE] bg-white px-3 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922] sm:px-4"
          aria-label="Next month"
        >
          Next
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#5F604E]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-green-300 bg-green-50" />
          Available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-stone-300 bg-stone-100" />
          Blocked
        </span>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Month calendar">
        {WEEKDAY_LABELS.map((weekday) => (
          <div
            key={weekday}
            className="px-1 pb-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[#6F745A] sm:px-2 sm:pb-2 sm:text-xs sm:tracking-[0.16em]"
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
            cell.isoDate !== null && selectedDates.includes(cell.isoDate);
          const stateLabel = isBlocked ? "Blocked" : "Available";

          return (
            <div
              key={cell.isoDate ?? `empty-${index}`}
              className={`min-h-16 rounded-xl border px-2 py-2 text-sm sm:min-h-20 sm:rounded-2xl sm:px-3 sm:py-3 ${
                cell.dayNumber === null
                  ? "border-transparent bg-transparent"
                  : isSelected
                    ? isToday
                      ? isBlocked
                        ? "border-[#D6A84F] bg-stone-700 text-white shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                        : "border-[#D6A84F] bg-green-700 text-white shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                      : isBlocked
                        ? "border-[#D6A84F] bg-stone-100 text-stone-900 shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                        : "border-[#D6A84F] bg-green-50 text-stone-900 shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                    : isToday
                    ? isBlocked
                      ? "border-stone-700 bg-stone-700 text-white"
                      : "border-green-700 bg-green-700 text-white"
                    : isBlocked
                      ? "border-stone-300 bg-stone-100 text-stone-800"
                      : "border-green-300 bg-green-50 text-stone-900"
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
                  onClick={() => toggleSelectedDate(cell.isoDate)}
                  className="flex h-full min-h-10 w-full items-start text-left sm:min-h-0"
                >
                  <span className="font-medium">{cell.dayNumber}</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {selectedCount > 0 ? (
        <div className="mt-6 rounded-3xl border border-[#D8CDBA] bg-[#F6F0E6] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[#2B2922]">
                Set availability
              </h3>
              <p className="text-sm text-[#5F604E]">
                {selectedDateLabel
                  ? selectedDateLabel
                  : `${selectedCount} dates selected`}
              </p>
              {selectedDateLabel ? (
                <p className="text-sm font-medium text-[#2B2922]">
                  Current: {selectedDayStateLabel}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDates([])}
              className="min-h-11 rounded-full border border-[#CFC3AE] bg-white px-4 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922]"
            >
              Clear selection
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => updateSelectedDayAvailability("unavailable")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-stone-300 bg-stone-100 px-4 py-3 text-sm font-medium text-stone-800 transition hover:bg-stone-200 sm:w-auto"
            >
              Mark selected blocked
            </button>
            <button
              type="button"
              onClick={() => updateSelectedDayAvailability("available")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-4 py-3 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
            >
              Mark selected available
            </button>
            {saveError ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span className="block font-medium">
                  Availability could not be saved.
                </span>
                <span>
                  No availability changes were saved. Try again, or refresh
                  admin before changing more dates.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
