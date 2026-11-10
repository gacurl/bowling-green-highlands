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
  requestedDates: "2026-06-14 09:00 to 09:30",
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

  const paidMarkup = await renderRequestPage(paidRequest.id);

  assert.doesNotMatch(paidMarkup, /Send this payment link/i);
  assert.doesNotMatch(paidMarkup, new RegExp(paymentUrl));
  assert.match(
    paidMarkup,
    /Payment is already marked paid\. No payment link is needed\./,
  );

  for (const request of [pendingRequest, declinedRequest]) {
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
