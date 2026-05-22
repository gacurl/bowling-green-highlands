import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createReservationRequestRecord,
  readReservationRequests,
} from "./reservation-requests";

async function createStorePath() {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-requests-"));

  return path.join(directory, "reservation-requests.json");
}

test("returns empty array when no request store exists", async () => {
  assert.deepEqual(await readReservationRequests(await createStorePath()), []);
});

test("stores and reads pending reservation requests", async () => {
  const storePath = await createStorePath();

  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "guest1@example.com",
      guestName: "Guest One",
      requestNotes: "First note",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );

  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "guest2@example.com",
      guestName: "Guest Two",
      requestNotes: "Second note",
      requestedDates: "2026-06-15 10:00 to 10:30",
    },
    storePath,
  );

  const reservationRequests = await readReservationRequests(storePath);

  assert.equal(reservationRequests.length, 2);
  assert.equal(reservationRequests[0].status, "pending");
  assert.equal(reservationRequests[0].id, firstRequest.id);
  assert.equal(reservationRequests[1].status, "pending");
  assert.equal(reservationRequests[1].id, secondRequest.id);
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[0].createdAt)));
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[1].createdAt)));
});
