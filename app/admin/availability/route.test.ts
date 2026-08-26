import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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

test("availability persistence failures return a safe recovery message", async () => {
  const previousStorePath = process.env.BGH_AVAILABILITY_STORE_PATH;
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-availability-fail-"));
  const unwritableStorePath = path.join(directory, "availability-directory");

  await mkdir(unwritableStorePath);
  process.env.BGH_AVAILABILITY_STORE_PATH = unwritableStorePath;

  try {
    const response = await POST(
      createAvailabilityRequest({
        date: "2026-06-14",
        mode: "available",
      }),
    );
    const body = (await response.json()) as { error?: string };

    assert.equal(response.status, 500);
    assert.equal(
      body.error,
      "Availability could not be saved. No availability changes were saved.",
    );
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BGH_AVAILABILITY_STORE_PATH;
    } else {
      process.env.BGH_AVAILABILITY_STORE_PATH = previousStorePath;
    }
  }
});
