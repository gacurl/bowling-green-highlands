import test from "node:test";
import assert from "node:assert/strict";
import {
  formatRequestedSlotLabel,
  formatRequestedSlotValue,
  parseRequestedSlotValue,
} from "./requested-slot";

test("formats canonical requested slot values", () => {
  assert.equal(
    formatRequestedSlotValue({
      date: "2026-06-14",
      startTime: "09:00",
      endTime: "09:30",
    }),
    "2026-06-14 09:00 to 09:30",
  );
});

test("parses canonical requested slot values", () => {
  assert.deepEqual(
    parseRequestedSlotValue("2026-06-14 09:00 to 09:30"),
    {
      date: "2026-06-14",
      endTime: "09:30",
      startTime: "09:00",
    },
  );
});

test("rejects malformed requested slot values", () => {
  assert.equal(parseRequestedSlotValue("2026-06-14 9:00 to 09:30"), null);
  assert.equal(parseRequestedSlotValue("2026/06/14 09:00 to 09:30"), null);
  assert.equal(parseRequestedSlotValue("bad-value"), null);
});

test("formats friendly requested slot labels", () => {
  assert.equal(
    formatRequestedSlotLabel("2026-06-14 09:00 to 09:30"),
    "Sunday, June 14, 2026, 09:00 to 09:30",
  );
});

test("returns original value when friendly formatting cannot parse", () => {
  assert.equal(formatRequestedSlotLabel("bad-value"), "bad-value");
});
