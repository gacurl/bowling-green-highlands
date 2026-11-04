import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AVAILABILITY_DURATION_OPTIONS,
  buildCalendarWeeks,
  formatClockTime,
  formatDurationOption,
  formatSelectedDateCount,
  formatStartTimeValue,
  getSelectableDates,
  getSelectionWindowState,
  MonthCalendar,
  parseStartTimeValue,
  saveSelectedDateAvailability,
  type AvailabilityUpdate,
  updateSelectedDates,
} from "./month-calendar";
import type { OperatorAvailability } from "../../lib/operator-availability";

const CALENDAR_MARKUP = renderToStaticMarkup(
  createElement(MonthCalendar, {
    initialAvailability: {
      "2026-11-03": { mode: "available" },
      "2026-11-04": { mode: "unavailable" },
    },
    todayIso: "2026-11-03",
  }),
);

function getDateButton(markup: string, label: string) {
  const button = markup.match(
    new RegExp(`<button[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?</button>`),
  );

  assert.ok(button, `Expected a date button labeled "${label}"`);
  return button[0];
}

test("renders persistent markers for configured and default-blocked dates", () => {
  const availableButton = getDateButton(
    CALENDAR_MARKUP,
    "2026-11-03, Available, today",
  );
  const blockedButton = getDateButton(
    CALENDAR_MARKUP,
    "2026-11-04, Blocked",
  );
  const unconfiguredButton = getDateButton(
    CALENDAR_MARKUP,
    "2026-11-05, Blocked",
  );

  assert.match(availableButton, />✓</);
  assert.match(availableButton, />Available</);
  assert.match(blockedButton, />×</);
  assert.match(blockedButton, />Blocked</);
  assert.match(unconfiguredButton, />×</);
  assert.match(unconfiguredButton, />Blocked</);
});

test("puts today and selection accessibility state on each date button", () => {
  const todayButton = getDateButton(
    CALENDAR_MARKUP,
    "2026-11-03, Available, today",
  );
  const otherButton = getDateButton(
    CALENDAR_MARKUP,
    "2026-11-04, Blocked",
  );

  assert.match(todayButton, /aria-current="date"/);
  assert.match(todayButton, /aria-pressed="false"/);
  assert.match(todayButton, />Today</);
  assert.doesNotMatch(otherButton, /aria-current=/);
  assert.match(otherButton, /aria-pressed="false"/);
});

test("renders an accessible visible four-state legend", () => {
  const legend = CALENDAR_MARKUP.match(
    /<ul[^>]*aria-label="Calendar legend"[^>]*>[\s\S]*?<\/ul>/,
  );

  assert.ok(legend, "Expected a labeled calendar legend");
  assert.match(legend[0], />Available</);
  assert.match(legend[0], />Blocked</);
  assert.match(legend[0], />Selected</);
  assert.match(legend[0], />Today</);
  assert.match(legend[0], />✓</);
  assert.match(legend[0], />×</);
});

test("renders month and visible-row week selection controls", () => {
  assert.match(
    CALENDAR_MARKUP,
    /aria-label="Select all dates in November 2026"/,
  );

  const weekLabels = [...CALENDAR_MARKUP.matchAll(/aria-label="Select week ([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(weekLabels, [
    "2026-11-01 through 2026-11-07",
    "2026-11-08 through 2026-11-14",
    "2026-11-15 through 2026-11-21",
    "2026-11-22 through 2026-11-28",
    "2026-11-29 through 2026-11-30",
  ]);
});

test("week and month selections exclude hidden adjacent-month dates", () => {
  const weeks = buildCalendarWeeks(new Date(2026, 10, 1));
  const monthDates = weeks.flatMap(getSelectableDates);

  assert.equal(weeks.length, 5);
  assert.deepEqual(getSelectableDates(weeks[0]), [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
  ]);
  assert.deepEqual(getSelectableDates(weeks[4]), [
    "2026-11-29",
    "2026-11-30",
  ]);
  assert.equal(monthDates.length, 30);
  assert.ok(monthDates.every((date) => date.startsWith("2026-11-")));
});

test("bulk selection adds sorted dates without duplicates", () => {
  const weeks = buildCalendarWeeks(new Date(2026, 10, 1));
  const firstWeek = getSelectableDates(weeks[0]);
  const monthDates = weeks.flatMap(getSelectableDates);

  const selectedWeek = updateSelectedDates(["2026-11-03"], {
    type: "add",
    dates: firstWeek,
  });
  const selectedMonth = updateSelectedDates(selectedWeek, {
    type: "add",
    dates: monthDates,
  });

  assert.deepEqual(selectedWeek, firstWeek);
  assert.deepEqual(selectedMonth, monthDates);
});

test("individual selection toggles and clear selection remain available", () => {
  const firstSelection = updateSelectedDates([], {
    type: "toggle",
    date: "2026-11-03",
  });
  const secondSelection = updateSelectedDates(firstSelection, {
    type: "toggle",
    date: "2026-11-01",
  });
  const deselected = updateSelectedDates(secondSelection, {
    type: "toggle",
    date: "2026-11-03",
  });
  const cleared = updateSelectedDates(deselected, { type: "clear" });

  assert.deepEqual(firstSelection, ["2026-11-03"]);
  assert.deepEqual(secondSelection, ["2026-11-01", "2026-11-03"]);
  assert.deepEqual(deselected, ["2026-11-01"]);
  assert.deepEqual(cleared, []);
});

test("renders and formats the always-visible selected-date count", () => {
  assert.match(CALENDAR_MARKUP, />0 dates selected</);
  assert.equal(formatSelectedDateCount(0), "0 dates selected");
  assert.equal(formatSelectedDateCount(1), "1 date selected");
  assert.equal(formatSelectedDateCount(30), "30 dates selected");
});

test("provides valid duration choices and clear time labels", () => {
  assert.equal(AVAILABILITY_DURATION_OPTIONS.length, 24);
  assert.equal(AVAILABILITY_DURATION_OPTIONS[0], 20);
  assert.equal(AVAILABILITY_DURATION_OPTIONS.at(-1), 480);
  assert.equal(formatDurationOption(20), "20 minutes");
  assert.equal(formatDurationOption(60), "1 hour");
  assert.equal(formatDurationOption(80), "1 hour 20 minutes");
  assert.equal(formatDurationOption(480), "8 hours");
  assert.equal(parseStartTimeValue("09:20"), 560);
  assert.equal(parseStartTimeValue("9:20"), null);
  assert.equal(parseStartTimeValue("24:00"), null);
  assert.equal(formatStartTimeValue(560), "09:20");
  assert.equal(formatClockTime(560), "9:20 AM");
  assert.equal(formatClockTime(17 * 60), "5:00 PM");
  assert.equal(formatClockTime(24 * 60), "12:00 AM");
});

test("prefills only a common existing window", () => {
  const availability: OperatorAvailability = {
    "2026-11-01": {
      durationMinutes: 120,
      mode: "available",
      startMinute: 540,
    },
    "2026-11-02": {
      durationMinutes: 120,
      mode: "available",
      startMinute: 540,
    },
    "2026-11-03": {
      durationMinutes: 80,
      mode: "available",
      startMinute: 600,
    },
    "2026-11-04": { mode: "unavailable" },
  };

  assert.deepEqual(getSelectionWindowState(availability, ["2026-11-01"]), {
    durationMinutes: 120,
    kind: "common",
    startMinute: 540,
  });
  assert.deepEqual(
    getSelectionWindowState(availability, ["2026-11-01", "2026-11-02"]),
    {
      durationMinutes: 120,
      kind: "common",
      startMinute: 540,
    },
  );
  assert.deepEqual(
    getSelectionWindowState(availability, ["2026-11-01", "2026-11-03"]),
    { kind: "mixed" },
  );
  assert.deepEqual(
    getSelectionWindowState(availability, ["2026-11-01", "2026-11-04"]),
    { kind: "mixed" },
  );
  assert.deepEqual(
    getSelectionWindowState(availability, ["2026-11-04", "2026-11-05"]),
    { kind: "none" },
  );
});

test("confirms every successful per-date availability save", async () => {
  const attempts: Array<{ date: string; update: AvailabilityUpdate }> = [];
  const dates = ["2026-11-01", "2026-11-02", "2026-11-03"];
  const update: AvailabilityUpdate = {
    durationMinutes: 80,
    mode: "available",
    startMinute: 600,
  };

  const result = await saveSelectedDateAvailability(
    dates,
    update,
    async (date, savedUpdate) => {
      attempts.push({ date, update: savedUpdate });
      return true;
    },
  );

  assert.deepEqual(attempts, dates.map((date) => ({ date, update })));
  assert.deepEqual(result, {
    confirmedDates: dates,
    unresolvedDates: [],
  });
});

test("stops after an uncertain partial save and retries only unresolved dates", async () => {
  const dates = ["2026-11-01", "2026-11-02", "2026-11-03"];
  const update: AvailabilityUpdate = {
    durationMinutes: 160,
    mode: "available",
    startMinute: 620,
  };
  const firstAttempts: Array<{ date: string; update: AvailabilityUpdate }> = [];

  const firstResult = await saveSelectedDateAvailability(
    dates,
    update,
    async (date, savedUpdate) => {
      firstAttempts.push({ date, update: savedUpdate });
      if (date === "2026-11-02") {
        throw new Error("Connection ended before confirmation");
      }
      return true;
    },
  );

  assert.deepEqual(firstAttempts, [
    { date: "2026-11-01", update },
    { date: "2026-11-02", update },
  ]);
  assert.deepEqual(firstResult, {
    confirmedDates: ["2026-11-01"],
    unresolvedDates: ["2026-11-02", "2026-11-03"],
  });

  const retryAttempts: Array<{ date: string; update: AvailabilityUpdate }> = [];
  const retryResult = await saveSelectedDateAvailability(
    firstResult.unresolvedDates,
    update,
    async (date, savedUpdate) => {
      retryAttempts.push({ date, update: savedUpdate });
      return true;
    },
  );

  assert.deepEqual(retryAttempts, [
    { date: "2026-11-02", update },
    { date: "2026-11-03", update },
  ]);
  assert.deepEqual(retryResult, {
    confirmedDates: ["2026-11-02", "2026-11-03"],
    unresolvedDates: [],
  });
});
