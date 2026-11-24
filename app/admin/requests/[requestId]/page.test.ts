import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { setDatabaseForTests } from "../../../../lib/server/database";
import { createTestDatabase } from "../../../../lib/test-support/postgres-test-database";
import {
  writeReservationRequests,
  type ReservationRequestRecord,
} from "../../../lib/reservation-requests";
import RequestDetailPage from "./page";

const acceptedRequest: ReservationRequestRecord = {
  createdAt: "2026-06-14T09:00:00.000Z",
  eventType: "farm_stay",
  guestEmail: "accepted@example.com",
  guestName: "Accepted Guest",
  id: "accepted id/with?characters#",
  paymentStatus: "unpaid",
  requestNotes: "private notes",
  requestedDates: "2026-11-19 16:45",
  sessionDurationMinutes: 30,
  status: "accepted",
};

const paidRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  id: "paid-id",
  paymentStatus: "paid",
  requestedDates: "2026-06-15 09:00 to 09:30",
};

const pendingRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  id: "pending-id",
  requestedDates: "2026-06-16 09:00 to 09:30",
  status: "pending",
};

const declinedRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  id: "declined-id",
  requestedDates: "2026-06-17 09:00 to 09:30",
  status: "declined",
};

function restoreEnvironmentValue(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("Admin shows one sendable payment URL only when payment is ready", async (t) => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalPriceId = process.env.STRIPE_CHECKOUT_PRICE_ID;
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;

  setDatabaseForTests(await createTestDatabase());
  await writeReservationRequests([
    acceptedRequest,
    paidRequest,
    pendingRequest,
    declinedRequest,
  ]);

  t.after(() => {
    setDatabaseForTests(null);
    restoreEnvironmentValue("NEXT_PUBLIC_APP_URL", originalAppUrl);
    restoreEnvironmentValue("STRIPE_CHECKOUT_PRICE_ID", originalPriceId);
    restoreEnvironmentValue("STRIPE_SECRET_KEY", originalSecretKey);
  });

  process.env.NEXT_PUBLIC_APP_URL = "https://EXAMPLE.com:443/";
  process.env.STRIPE_CHECKOUT_PRICE_ID = "price_configured";
  process.env.STRIPE_SECRET_KEY = "sk_test_configured";

  async function renderRequestPage(requestId: string) {
    return renderToStaticMarkup(
      await RequestDetailPage({
        params: Promise.resolve({ requestId }),
      }),
    );
  }

  const paymentUrl =
    "https://example.com/pay/accepted%20id%2Fwith%3Fcharacters%23";
  const acceptedMarkup = await renderRequestPage(acceptedRequest.id);

  assert.match(acceptedMarkup, /Send this payment link to the customer\./);
  assert.equal(acceptedMarkup.split(`href="${paymentUrl}"`).length - 1, 1);
  assert.ok(acceptedMarkup.includes(`>${paymentUrl}</a>`));
  assert.doesNotMatch(acceptedMarkup, /No action needed/i);
  assert.match(
    acceptedMarkup,
    /Thursday, November 19, 2026 at 4:45 PM Eastern Time/,
  );

  const paidMarkup = await renderRequestPage(paidRequest.id);

  assert.doesNotMatch(paidMarkup, /Send this payment link/i);
  assert.doesNotMatch(paidMarkup, new RegExp(paymentUrl));
  assert.match(
    paidMarkup,
    /Payment is already marked paid\. No payment link is needed\./,
  );

  const pendingMarkup = await renderRequestPage(pendingRequest.id);

  assert.match(pendingMarkup, /Session duration/);
  assert.match(pendingMarkup, /30 minutes/);
  assert.match(pendingMarkup, /Accept request/);
  assert.doesNotMatch(pendingMarkup, /name="sessionDurationMinutes"/);

  for (const request of [declinedRequest]) {
    const markup = await renderRequestPage(request.id);

    assert.doesNotMatch(markup, /Send this payment link/i);
    assert.doesNotMatch(markup, /https:\/\/example\.com\/pay\//);
  }

  delete process.env.STRIPE_SECRET_KEY;
  const unconfiguredMarkup = await renderRequestPage(acceptedRequest.id);

  assert.doesNotMatch(unconfiguredMarkup, /Send this payment link/i);
  assert.match(
    unconfiguredMarkup,
    /A secure payment link is not available\. Check the payment configuration before contacting the customer\./,
  );

  process.env.STRIPE_SECRET_KEY = "sk_test_configured";
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
  const localHttpMarkup = await renderRequestPage(acceptedRequest.id);

  assert.doesNotMatch(localHttpMarkup, /Send this payment link/i);
  assert.match(localHttpMarkup, /A secure payment link is not available\./);
});

test("Admin captures missing duration without blocking independent decline", async (t) => {
  const pendingDurationRequest: ReservationRequestRecord = {
    ...acceptedRequest,
    id: "pending-duration-id",
    requestedDates: "2026-12-01 09:00",
    sessionDurationMinutes: undefined,
    status: "pending",
  };
  const unresolvedRequest: ReservationRequestRecord = {
    ...pendingDurationRequest,
    id: "unresolved-id",
    requestedDates: "Call to arrange a date",
  };
  const acceptedIncompleteRequest: ReservationRequestRecord = {
    ...pendingDurationRequest,
    id: "accepted-incomplete-id",
    status: "accepted",
  };
  const database = await createTestDatabase();

  setDatabaseForTests(database);
  await writeReservationRequests([
    pendingDurationRequest,
    unresolvedRequest,
    acceptedIncompleteRequest,
  ]);
  t.after(() => {
    setDatabaseForTests(null);
  });

  async function renderRequestPage(requestId: string) {
    return renderToStaticMarkup(
      await RequestDetailPage({
        params: Promise.resolve({ requestId }),
      }),
    );
  }

  const durationMarkup = await renderRequestPage(pendingDurationRequest.id);
  const durationInput = durationMarkup.match(
    /<input[^>]*name="sessionDurationMinutes"[^>]*>/,
  )?.[0];

  assert.match(durationMarkup, /Session duration \(minutes\)/);
  assert.match(durationMarkup, /Session duration<\/dt><dd>Not recorded/);
  assert.ok(durationInput);
  assert.match(durationInput, /type="number"/);
  assert.match(durationInput, /min="1"/);
  assert.match(durationInput, /max="900"/);
  assert.match(durationInput, /step="1"/);
  assert.match(durationInput, /required=""/);
  assert.doesNotMatch(durationInput, /value=/);
  assert.ok(
    durationMarkup.indexOf("Accept request") <
      durationMarkup.indexOf("Decline request"),
  );
  assert.equal(
    durationMarkup.split(
      `action="/admin/requests/${pendingDurationRequest.id}/status"`,
    ).length - 1,
    2,
  );

  const unresolvedMarkup = await renderRequestPage(unresolvedRequest.id);

  assert.match(
    unresolvedMarkup,
    /Acceptance is unavailable because this request does not have a reliable date and start time\./,
  );
  assert.doesNotMatch(unresolvedMarkup, /Accept request/);
  assert.doesNotMatch(unresolvedMarkup, /name="sessionDurationMinutes"/);
  assert.match(unresolvedMarkup, /Decline request/);
  assert.equal(
    unresolvedMarkup.split(
      `action="/admin/requests/${unresolvedRequest.id}/status"`,
    ).length - 1,
    1,
  );

  const historicalMarkup = await renderRequestPage(
    acceptedIncompleteRequest.id,
  );

  assert.match(historicalMarkup, /Session duration<\/dt><dd>Not recorded/);
  assert.doesNotMatch(historicalMarkup, /Accept request/);
  assert.doesNotMatch(historicalMarkup, /Decline request/);
});
