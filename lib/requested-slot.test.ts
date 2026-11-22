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

test("parses preferred-time requested values without inventing an end time", () => {
  assert.deepEqual(parseRequestedSlotValue("2026-06-14 09:00"), {
    date: "2026-06-14",
    startTime: "09:00",
  });
});

test("rejects malformed requested slot values", () => {
  assert.equal(parseRequestedSlotValue("2026-06-14 9:00 to 09:30"), null);
  assert.equal(parseRequestedSlotValue("2026/06/14 09:00 to 09:30"), null);
  assert.equal(parseRequestedSlotValue("2026-02-30 09:00 to 09:30"), null);
  assert.equal(parseRequestedSlotValue("2026-06-14 09:00 to"), null);
  assert.equal(parseRequestedSlotValue("bad-value"), null);
});

test("formats friendly requested slot labels", () => {
  assert.equal(
    formatRequestedSlotLabel("2026-06-14 09:00 to 09:30"),
    "Sunday, June 14, 2026 at 9:00 AM to 9:30 AM Eastern Time",
  );
});

test("formats friendly preferred-time labels", () => {
  assert.equal(
    formatRequestedSlotLabel("2026-11-19 16:45"),
    "Thursday, November 19, 2026 at 4:45 PM Eastern Time",
  );
});

test("formats midnight and noon in 12-hour Eastern Time", () => {
  assert.equal(
    formatRequestedSlotLabel("2026-11-19 00:00"),
    "Thursday, November 19, 2026 at 12:00 AM Eastern Time",
  );
  assert.equal(
    formatRequestedSlotLabel("2026-11-19 12:00"),
    "Thursday, November 19, 2026 at 12:00 PM Eastern Time",
  );
});

test("formats calendar dates independently of the machine timezone", () => {
  const originalTimeZone = process.env.TZ;

  try {
    for (const timeZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timeZone;
      assert.equal(
        formatRequestedSlotLabel("2026-11-19 16:45"),
        "Thursday, November 19, 2026 at 4:45 PM Eastern Time",
      );
    }
  } finally {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  }
});

test("returns original value when friendly formatting cannot parse", () => {
  assert.equal(formatRequestedSlotLabel("bad-value"), "bad-value");
});
