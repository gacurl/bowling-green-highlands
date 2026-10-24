import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { setDatabaseForTests } from "../../lib/server/database";
import { createTestDatabase } from "../../lib/test-support/postgres-test-database";
import AdminPage from "./page";

test("renders reservation requests above the availability calendar", async (t) => {
  setDatabaseForTests(await createTestDatabase());

  t.after(() => setDatabaseForTests(null));

  const markup = renderToStaticMarkup(await AdminPage({}));
  const requestsBarIndex = markup.indexOf(">Reservation requests</h2>");
  const calendarIndex = markup.indexOf('aria-label="Month calendar"');

  assert.notEqual(requestsBarIndex, -1);
  assert.notEqual(calendarIndex, -1);
  assert.ok(requestsBarIndex < calendarIndex);
});
