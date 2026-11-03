import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthCalendar } from "./month-calendar";

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
