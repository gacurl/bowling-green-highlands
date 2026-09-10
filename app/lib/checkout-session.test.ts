import test from "node:test";
import assert from "node:assert/strict";
import {
  createReservationCheckoutSession,
  type CheckoutSessionCreateParams,
} from "./checkout-session";
import type { ReservationRequestRecord } from "./reservation-requests";

const acceptedRequest: ReservationRequestRecord = {
  createdAt: "2026-06-14T09:00:00.000Z",
  eventType: "farm_stay",
  guestEmail: "accepted@example.com",
  guestName: "Accepted Guest",
  id: "accepted-id",
  requestNotes: "private notes",
  requestedDates: "2026-06-14 09:00 to 09:30",
  status: "accepted",
};

const pendingRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  guestEmail: "pending@example.com",
  id: "pending-id",
  status: "pending",
};

const declinedRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  guestEmail: "declined@example.com",
  id: "declined-id",
  status: "declined",
};

function createFakeStripeSessionRecorder() {
  const calls: CheckoutSessionCreateParams[] = [];

  return {
    calls,
    createSession: async (params: CheckoutSessionCreateParams) => {
      calls.push(params);

      return {
        url: "https://checkout.stripe.test/session",
      };
    },
  };
}

test("accepted request can create a Checkout Session", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();
  const result = await createReservationCheckoutSession({
    appUrl: "https://example.com",
    createSession: fakeStripe.createSession,
    loadRequests: async () => [acceptedRequest],
    priceId: "price_configured",
    requestId: "accepted-id",
  });

  assert.deepEqual(result, {
    kind: "created",
    url: "https://checkout.stripe.test/session",
  });
  assert.equal(fakeStripe.calls.length, 1);
});

test("pending, declined, and unknown requests cannot create Checkout Sessions", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();
  const requests = [pendingRequest, declinedRequest];

  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "https://example.com",
      createSession: fakeStripe.createSession,
      loadRequests: async () => requests,
      priceId: "price_configured",
      requestId: "pending-id",
    }),
    {
      kind: "unavailable",
      reason: "not_accepted",
    },
  );
  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "https://example.com",
      createSession: fakeStripe.createSession,
      loadRequests: async () => requests,
      priceId: "price_configured",
      requestId: "declined-id",
    }),
    {
      kind: "unavailable",
      reason: "not_accepted",
    },
  );
  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "https://example.com",
      createSession: fakeStripe.createSession,
      loadRequests: async () => requests,
      priceId: "price_configured",
      requestId: "missing-id",
    }),
    {
      kind: "unavailable",
      reason: "not_found",
    },
  );
  assert.equal(fakeStripe.calls.length, 0);
});

test("missing Stripe configuration fails closed", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();

  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "https://example.com",
      createSession: null,
      loadRequests: async () => [acceptedRequest],
      priceId: "price_configured",
      requestId: "accepted-id",
    }),
    {
      kind: "unavailable",
      reason: "missing_config",
    },
  );
  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "https://example.com",
      createSession: fakeStripe.createSession,
      loadRequests: async () => [acceptedRequest],
      priceId: "",
      requestId: "accepted-id",
    }),
    {
      kind: "unavailable",
      reason: "missing_config",
    },
  );
  assert.deepEqual(
    await createReservationCheckoutSession({
      appUrl: "",
      createSession: fakeStripe.createSession,
      loadRequests: async () => [acceptedRequest],
      priceId: "price_configured",
      requestId: "accepted-id",
    }),
    {
      kind: "unavailable",
      reason: "missing_config",
    },
  );
  assert.equal(fakeStripe.calls.length, 0);
});

test("stored email, configured Price ID, and reservation ID are sent to Stripe", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();

  await createReservationCheckoutSession({
    appUrl: "https://example.com/",
    createSession: fakeStripe.createSession,
    loadRequests: async () => [acceptedRequest],
    priceId: "price_configured",
    requestId: "accepted-id",
  });

  assert.deepEqual(fakeStripe.calls[0], {
    cancel_url: "https://example.com/pay/accepted-id?checkout=cancelled",
    client_reference_id: "accepted-id",
    customer_email: "accepted@example.com",
    line_items: [
      {
        price: "price_configured",
        quantity: 1,
      },
    ],
    metadata: {
      reservationRequestId: "accepted-id",
    },
    mode: "payment",
    success_url: "https://example.com/pay/accepted-id?checkout=returned",
  });
});

test("unreadable reservation requests fail closed without calling Stripe", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();
  const result = await createReservationCheckoutSession({
    appUrl: "https://example.com",
    createSession: fakeStripe.createSession,
    loadRequests: async () => {
      throw new Error("store unavailable");
    },
    priceId: "price_configured",
    requestId: "accepted-id",
  });

  assert.deepEqual(result, {
    kind: "unavailable",
    reason: "unreadable",
  });
  assert.equal(fakeStripe.calls.length, 0);
});
