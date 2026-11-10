import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createTestDatabase } from "../../../lib/test-support/postgres-test-database";
import { setDatabaseForTests } from "../../../lib/server/database";
import {
  writeReservationRequests,
  type ReservationRequestRecord,
} from "../../lib/reservation-requests";
import PaymentPage from "./page";

const acceptedRequest: ReservationRequestRecord = {
  createdAt: "2026-06-14T09:00:00.000Z",
  eventType: "farm_stay",
  guestEmail: "accepted@example.com",
  guestName: "Accepted Guest",
  id: "accepted-id",
  paymentStatus: "unpaid",
  requestNotes: "private notes",
  requestedDates: "2026-06-14 09:00 to 09:30",
  status: "accepted",
};

function restoreEnvironmentValue(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("payment page exposes secure payment only when Checkout is ready", async (t) => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalPriceId = process.env.STRIPE_CHECKOUT_PRICE_ID;
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;

  setDatabaseForTests(await createTestDatabase());
  await writeReservationRequests([acceptedRequest]);

  t.after(() => {
    setDatabaseForTests(null);
    restoreEnvironmentValue("NEXT_PUBLIC_APP_URL", originalAppUrl);
    restoreEnvironmentValue("STRIPE_CHECKOUT_PRICE_ID", originalPriceId);
    restoreEnvironmentValue("STRIPE_SECRET_KEY", originalSecretKey);
  });

  process.env.STRIPE_CHECKOUT_PRICE_ID = "price_configured";
  process.env.STRIPE_SECRET_KEY = "sk_test_configured";

  async function renderPaymentPage(appUrl: string | undefined) {
    restoreEnvironmentValue("NEXT_PUBLIC_APP_URL", appUrl);

    return renderToStaticMarkup(
      await PaymentPage({
        params: Promise.resolve({ requestId: "accepted-id" }),
      }),
    );
  }

  for (const appUrl of [
    undefined,
    "not-a-url",
    "javascript:alert(1)",
    "https://example.com/path",
    "https://example.com?",
    "https://example.com#",
  ]) {
    const markup = await renderPaymentPage(appUrl);

    assert.doesNotMatch(markup, />Pay securely</, String(appUrl));
    assert.match(markup, /Payment is not available\./, String(appUrl));
  }

  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  delete process.env.STRIPE_SECRET_KEY;
  assert.doesNotMatch(await renderPaymentPage("https://example.com"), />Pay securely</);

  process.env.STRIPE_SECRET_KEY = "sk_test_configured";
  delete process.env.STRIPE_CHECKOUT_PRICE_ID;
  assert.doesNotMatch(await renderPaymentPage("https://example.com"), />Pay securely</);

  process.env.STRIPE_CHECKOUT_PRICE_ID = "price_configured";

  for (const appUrl of [
    "http://127.0.0.1:3000",
    "https://example.com/",
  ]) {
    const markup = await renderPaymentPage(appUrl);

    assert.match(markup, />Pay securely</, appUrl);
    assert.match(markup, /Complete your payment\./, appUrl);
  }
});
