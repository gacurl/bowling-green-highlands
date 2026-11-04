import test from "node:test";
import assert from "node:assert/strict";
import { setDatabaseForTests } from "../../../lib/server/database";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
} from "../../../lib/test-support/postgres-test-database";
import {
  readOperatorAvailability,
  setOperatorDateAvailabilityWindow,
} from "../../../lib/operator-availability";
import { POST } from "./route";

function createAvailabilityRequest(body: unknown) {
  return new Request("http://localhost/admin/availability", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

test("invalid availability updates return a safe recovery message", async () => {
  const response = await POST(
    createAvailabilityRequest({ date: "bad-date", mode: "available" }),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(
    body.error,
    "Availability could not be saved. No availability changes were saved.",
  );
});

test("invalid calendar date updates return a safe recovery message", async () => {
  const response = await POST(
    createAvailabilityRequest({ date: "2026-02-30", mode: "available" }),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(
    body.error,
    "Availability could not be saved. No availability changes were saved.",
  );
});

test("available updates require a complete valid window", async () => {
  for (const body of [
    { date: "2026-06-14", mode: "available" },
    { date: "2026-06-14", mode: "available", startMinute: 540 },
    { date: "2026-06-14", durationMinutes: 120, mode: "available" },
    {
      date: "2026-06-14",
      durationMinutes: "120",
      mode: "available",
      startMinute: 540,
    },
    {
      date: "2026-06-14",
      durationMinutes: 15,
      mode: "available",
      startMinute: 540,
    },
    {
      date: "2026-06-14",
      durationMinutes: 500,
      mode: "available",
      startMinute: 540,
    },
    {
      date: "2026-06-14",
      durationMinutes: 480,
      mode: "available",
      startMinute: 1200,
    },
    {
      date: "2026-06-14",
      durationMinutes: 20,
      mode: "available",
      startMinute: 540.5,
    },
  ]) {
    const response = await POST(createAvailabilityRequest(body));
    const responseBody = (await response.json()) as { error?: string };

    assert.equal(response.status, 400);
    assert.equal(
      responseBody.error,
      "Availability could not be saved. No availability changes were saved.",
    );
  }
});

test("malformed availability requests return a safe client error", async () => {
  const response = await POST(
    new Request("http://localhost/admin/availability", {
      body: "{",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 400);
  assert.equal(
    body.error,
    "Availability could not be saved. No availability changes were saved.",
  );
});

test("valid minimum and maximum windows persist", async (t) => {
  const database = await createTestDatabase();
  setDatabaseForTests(database);
  t.after(() => setDatabaseForTests(null));

  const minimumResponse = await POST(
    createAvailabilityRequest({
      date: "2026-06-14",
      durationMinutes: 20,
      mode: "available",
      startMinute: 0,
    }),
  );
  const maximumResponse = await POST(
    createAvailabilityRequest({
      date: "2026-06-15",
      durationMinutes: 480,
      mode: "available",
      startMinute: 960,
    }),
  );

  assert.equal(minimumResponse.status, 200);
  assert.equal(maximumResponse.status, 200);
  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": {
      durationMinutes: 20,
      mode: "available",
      startMinute: 0,
    },
    "2026-06-15": {
      durationMinutes: 480,
      mode: "available",
      startMinute: 960,
    },
  });
});

test("blocked updates clear an existing window", async (t) => {
  const database = await createTestDatabase();
  setDatabaseForTests(database);
  t.after(() => setDatabaseForTests(null));
  await setOperatorDateAvailabilityWindow(
    "2026-06-14",
    10 * 60,
    80,
    database,
  );

  const response = await POST(
    createAvailabilityRequest({
      date: "2026-06-14",
      mode: "unavailable",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": { mode: "unavailable" },
  });
});

test("availability persistence failures return a safe recovery message", async () => {
  setDatabaseForTests(createUnavailableTestDatabase());

  try {
    const response = await POST(
      createAvailabilityRequest({
        date: "2026-06-14",
        durationMinutes: 120,
        mode: "available",
        startMinute: 540,
      }),
    );
    const body = (await response.json()) as { error?: string };

    assert.equal(response.status, 500);
    assert.equal(
      body.error,
      "Availability could not be saved. No availability changes were saved.",
    );
  } finally {
    setDatabaseForTests(null);
  }
});
