"use client";

import { useRef, useState } from "react";
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

export type CalendarCell = {
  dayNumber: number | null;
  isoDate: string | null;
};

export type SelectedDatesAction =
  | { type: "add"; dates: string[] }
  | { type: "clear" }
  | { type: "toggle"; date: string };

type AvailabilityDateSaver = (
  date: string,
  mode: OperatorAvailabilityMode,
) => Promise<boolean>;

export type AvailabilitySaveResult = {
  confirmedDates: string[];
  unresolvedDates: string[];
};

type AvailabilitySaveError = {
  confirmedCount: number;
  totalCount: number;
  unresolvedCount: number;
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

export function buildCalendarWeeks(monthDate: Date): CalendarCell[][] {
  const cells = buildCalendarCells(monthDate);
  const weeks: CalendarCell[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

export function getSelectableDates(cells: CalendarCell[]) {
  return cells.flatMap((cell) => (cell.isoDate ? [cell.isoDate] : []));
}

export function updateSelectedDates(
  current: string[],
  action: SelectedDatesAction,
) {
  if (action.type === "clear") {
    return [];
  }

  if (action.type === "toggle") {
    if (current.includes(action.date)) {
      return current.filter((selectedDate) => selectedDate !== action.date);
    }

    return [...current, action.date].sort((firstDate, secondDate) =>
      firstDate.localeCompare(secondDate),
    );
  }

  return [...new Set([...current, ...action.dates])].sort(
    (firstDate, secondDate) => firstDate.localeCompare(secondDate),
  );
}

export function formatSelectedDateCount(count: number) {
  return `${count} ${count === 1 ? "date" : "dates"} selected`;
}

export async function saveSelectedDateAvailability(
  dates: string[],
  mode: OperatorAvailabilityMode,
  saveDate: AvailabilityDateSaver,
): Promise<AvailabilitySaveResult> {
  const confirmedDates: string[] = [];

  for (const date of dates) {
    try {
      if (!(await saveDate(date, mode))) {
        break;
      }
    } catch {
      break;
    }

    confirmedDates.push(date);
  }

  return {
    confirmedDates,
    unresolvedDates: dates.slice(confirmedDates.length),
  };
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<AvailabilitySaveError | null>(
    null,
  );
  const saveInProgress = useRef(false);
  const calendarWeeks = buildCalendarWeeks(displayMonth);
  const monthDates = calendarWeeks.flatMap(getSelectableDates);
  const selectedCount = selectedDates.length;
  const selectedDateLabel =
    selectedCount === 1 ? formatSelectedDate(selectedDates[0]) : null;
  const selectedDayAvailability = selectedDateLabel
    ? dayAvailability[selectedDates[0]] ?? DEFAULT_DAY_AVAILABILITY
    : null;
  const selectedDayStateLabel =
    selectedDayAvailability?.mode === "available" ? "Available" : "Blocked";

  async function updateSelectedDayAvailability(mode: OperatorAvailabilityMode) {
    if (selectedCount === 0 || saveInProgress.current) {
      return;
    }

    const datesToUpdate = [...selectedDates];

    saveInProgress.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await saveSelectedDateAvailability(
        datesToUpdate,
        mode,
        async (dateToUpdate, modeToSave) => {
          const response = await fetch("/admin/availability", {
            body: JSON.stringify({ date: dateToUpdate, mode: modeToSave }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });

          return response.ok;
        },
      );

      if (result.confirmedDates.length > 0) {
        setDayAvailability((current) => {
          const nextAvailability = { ...current };
          for (const confirmedDate of result.confirmedDates) {
            nextAvailability[confirmedDate] = { mode };
          }
          return nextAvailability;
        });
      }

      if (result.unresolvedDates.length > 0) {
        setSelectedDates(result.unresolvedDates);
        setSaveError({
          confirmedCount: result.confirmedDates.length,
          totalCount: datesToUpdate.length,
          unresolvedCount: result.unresolvedDates.length,
        });
      }
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  function changeSelectedDates(action: SelectedDatesAction) {
    if (saveInProgress.current) {
      return;
    }

    setSaveError(null);
    setSelectedDates((current) => updateSelectedDates(current, action));
  }

  function toggleSelectedDate(date: string | null) {
    if (date) {
      changeSelectedDates({ type: "toggle", date });
    }
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
      <ul
        aria-label="Calendar legend"
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5F604E] sm:text-sm"
      >
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-green-700 bg-green-100 px-1 text-[10px] font-bold leading-none text-green-900"
          >
            ✓
          </span>
          Available
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-stone-600 bg-stone-200 px-1 text-[10px] font-bold leading-none text-stone-900"
          >
            ×
          </span>
          Blocked
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded border border-[#D6A84F] bg-[#FDF8EF] ring-2 ring-[#D6A84F] ring-offset-1 ring-offset-[#FDF8EF]"
          />
          Selected
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-stone-700 bg-stone-700 px-1 text-[9px] font-bold leading-none text-white"
          >
            T
          </span>
          Today
        </li>
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D8CDBA] bg-white px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() =>
            changeSelectedDates({ type: "add", dates: monthDates })
          }
          disabled={isSaving}
          className="min-h-11 rounded-full border border-[#CFC3AE] bg-white px-4 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922] disabled:cursor-wait disabled:opacity-60"
          aria-label={`Select all dates in ${formatMonthLabel(displayMonth)}`}
        >
          Select month
        </button>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm font-medium text-[#2B2922]"
        >
          {formatSelectedDateCount(selectedCount)}
          {isSaving ? (
            <span className="ml-2 text-[#5F604E]">Saving availability…</span>
          ) : null}
        </p>
      </div>
      <div className="mt-6" aria-label="Month calendar">
        <div className="flex gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAY_LABELS.map((weekday) => (
              <div
                key={weekday}
                className="px-1 pb-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[#6F745A] sm:px-2 sm:pb-2 sm:text-xs sm:tracking-[0.16em]"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="hidden w-24 shrink-0 sm:block" />
        </div>
        <div className="space-y-3">
          {calendarWeeks.map((week, weekIndex) => {
            const weekDates = getSelectableDates(week);
            const firstWeekDate = weekDates[0];
            const lastWeekDate = weekDates[weekDates.length - 1];

            return (
              <div
                key={firstWeekDate}
                className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
                role="group"
                aria-label={`Week ${firstWeekDate} through ${lastWeekDate}`}
              >
                <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5 sm:gap-2">
                  {week.map((cell, cellIndex) => {
                    const isToday = cell.isoDate === todayIso;
                    const dayState = cell.isoDate
                      ? dayAvailability[cell.isoDate] ??
                        DEFAULT_DAY_AVAILABILITY
                      : null;
                    const isBlocked = dayState?.mode === "unavailable";
                    const isSelected =
                      cell.isoDate !== null &&
                      selectedDates.includes(cell.isoDate);
                    const stateLabel = isBlocked ? "Blocked" : "Available";

                    if (cell.dayNumber === null) {
                      return (
                        <div
                          key={`empty-${weekIndex}-${cellIndex}`}
                          aria-hidden="true"
                          className="min-h-16 rounded-xl border border-transparent bg-transparent sm:min-h-20 sm:rounded-2xl"
                        />
                      );
                    }

                    return (
                      <button
                        key={cell.isoDate}
                        type="button"
                        onClick={() => toggleSelectedDate(cell.isoDate)}
                        disabled={isSaving}
                        className={`flex min-h-16 min-w-0 flex-col items-start rounded-xl border px-1 py-1.5 text-left text-sm transition disabled:cursor-wait disabled:opacity-60 sm:min-h-20 sm:rounded-2xl sm:px-2 sm:py-2 ${
                          isSelected
                            ? isToday
                              ? isBlocked
                                ? "border-[#D6A84F] bg-stone-700 text-white shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                                : "border-[#D6A84F] bg-green-700 text-white shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                              : isBlocked
                                ? "border-[#D6A84F] bg-stone-200 text-stone-900 shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                                : "border-[#D6A84F] bg-green-100 text-stone-900 shadow-lg ring-4 ring-[#D6A84F] ring-offset-2 ring-offset-[#FDF8EF]"
                            : isToday
                              ? isBlocked
                                ? "border-stone-700 bg-stone-700 text-white"
                                : "border-green-700 bg-green-700 text-white"
                              : isBlocked
                                ? "border-stone-500 bg-stone-200 text-stone-900"
                                : "border-green-600 bg-green-100 text-stone-900"
                        }`}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${cell.isoDate}, ${stateLabel}${isToday ? ", today" : ""}`}
                        aria-pressed={isSelected}
                      >
                        <span className="font-semibold leading-none">
                          {cell.dayNumber}
                        </span>
                        {isToday ? (
                          <span
                            aria-hidden="true"
                            className="mt-1 max-w-full rounded-sm border border-white/70 bg-white/15 px-px py-0.5 text-[7px] font-bold leading-none text-white sm:text-[9px]"
                          >
                            Today
                          </span>
                        ) : null}
                        <span
                          aria-hidden="true"
                          className={`mt-auto inline-flex min-h-5 min-w-5 max-w-full items-center justify-center gap-1 self-start rounded-full border px-1 py-0.5 text-[10px] font-bold leading-none sm:px-1.5 ${
                            isToday
                              ? "border-white/70 bg-white/15 text-white"
                              : isBlocked
                                ? "border-stone-600 bg-white text-stone-900"
                                : "border-green-700 bg-white text-green-900"
                          }`}
                        >
                          <span>{isBlocked ? "×" : "✓"}</span>
                          <span className="hidden sm:inline">{stateLabel}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    changeSelectedDates({ type: "add", dates: weekDates })
                  }
                  disabled={isSaving}
                  className="min-h-11 shrink-0 rounded-full border border-[#CFC3AE] bg-white px-3 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922] disabled:cursor-wait disabled:opacity-60 sm:w-24"
                  aria-label={`Select week ${firstWeekDate} through ${lastWeekDate}`}
                >
                  Select week
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {selectedCount > 0 ? (
        <div
          className="mt-6 rounded-3xl border border-[#D8CDBA] bg-[#F6F0E6] p-4 sm:p-5"
          aria-busy={isSaving}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[#2B2922]">
                Set availability
              </h3>
              <p className="text-sm text-[#5F604E]">
                {selectedDateLabel
                  ? selectedDateLabel
                  : formatSelectedDateCount(selectedCount)}
              </p>
              {selectedDateLabel ? (
                <p className="text-sm font-medium text-[#2B2922]">
                  Current: {selectedDayStateLabel}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => changeSelectedDates({ type: "clear" })}
              disabled={isSaving}
              className="min-h-11 rounded-full border border-[#CFC3AE] bg-white px-4 py-2 text-sm font-medium text-[#4F4B3F] transition hover:border-[#2F4A35] hover:text-[#2B2922] disabled:cursor-wait disabled:opacity-60"
            >
              Clear selection
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => updateSelectedDayAvailability("unavailable")}
              disabled={isSaving}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-stone-300 bg-stone-100 px-4 py-3 text-sm font-medium text-stone-800 transition hover:bg-stone-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              Mark selected blocked
            </button>
            <button
              type="button"
              onClick={() => updateSelectedDayAvailability("available")}
              disabled={isSaving}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-4 py-3 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              Mark selected available
            </button>
            {saveError ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span className="block font-medium">
                  Availability could not be fully confirmed.
                </span>
                <span>
                  Confirmed saved: {saveError.confirmedCount} of{" "}
                  {saveError.totalCount}{" "}
                  {saveError.totalCount === 1 ? "date" : "dates"}. Could not
                  be confirmed: {saveError.unresolvedCount}{" "}
                  {saveError.unresolvedCount === 1 ? "date" : "dates"}.
                  Unconfirmed dates remain selected. Try again, or refresh to
                  verify current availability.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
