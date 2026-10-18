import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "./page";

test("renders reservation requests above the availability calendar", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-admin-page-"));
  const previousAvailabilityStorePath =
    process.env.BGH_AVAILABILITY_STORE_PATH;
  const previousRequestsStorePath =
    process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;

  process.env.BGH_AVAILABILITY_STORE_PATH = path.join(
    directory,
    "operator-availability.json",
  );
  process.env.BGH_RESERVATION_REQUESTS_STORE_PATH = path.join(
    directory,
    "reservation-requests.json",
  );

  t.after(async () => {
    if (previousAvailabilityStorePath === undefined) {
      delete process.env.BGH_AVAILABILITY_STORE_PATH;
    } else {
      process.env.BGH_AVAILABILITY_STORE_PATH = previousAvailabilityStorePath;
    }

    if (previousRequestsStorePath === undefined) {
      delete process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;
    } else {
      process.env.BGH_RESERVATION_REQUESTS_STORE_PATH =
        previousRequestsStorePath;
    }

    await rm(directory, { force: true, recursive: true });
  });

  const markup = renderToStaticMarkup(await AdminPage({}));
  const requestsBarIndex = markup.indexOf(">Reservation requests</h2>");
  const calendarIndex = markup.indexOf('aria-label="Month calendar"');

  assert.notEqual(requestsBarIndex, -1);
  assert.notEqual(calendarIndex, -1);
  assert.ok(requestsBarIndex < calendarIndex);
});
