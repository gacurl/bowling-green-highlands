import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  classifyStripeWebhook,
  type StripeWebhookEventConstructor,
} from "./stripe-webhook";
import {
  getCheckoutReturnState,
  getPaymentPageContent,
} from "./payment-page-content";
import type { ReservationRequestRecord } from "./reservation-requests";

const API_KEY_PLACEHOLDER = "sk_test_change_this";
const WEBHOOK_SECRET_PLACEHOLDER = "whsec_change_this";
const RESERVATION_REQUEST_ID = "accepted-id";

const stripe = new Stripe(API_KEY_PLACEHOLDER);
const constructEvent: StripeWebhookEventConstructor = (
  rawBody,
  signature,
  webhookSecret,
) => stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

const acceptedRequest: ReservationRequestRecord = {
  createdAt: "2026-06-14T09:00:00.000Z",
  eventType: "farm_stay",
  guestEmail: "accepted@example.com",
  guestName: "Accepted Guest",
  id: RESERVATION_REQUEST_ID,
  requestNotes: "private notes",
  requestedDates: "2026-06-14 09:00 to 09:30",
  status: "accepted",
};

const pendingRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  status: "pending",
};

type EventPayloadOptions = {
  clientReferenceId?: string | null;
  eventId?: string;
  eventType?: string;
  metadata?: Record<string, string> | null;
  mode?: string;
  objectType?: string;
  paymentStatus?: string;
};

function createEventPayload(options: EventPayloadOptions = {}) {
  return JSON.stringify({
    data: {
      object: {
        client_reference_id:
          options.clientReferenceId === undefined
            ? RESERVATION_REQUEST_ID
            : options.clientReferenceId,
        id: "cs_test_webhook",
        metadata:
          options.metadata === undefined
            ? { reservationRequestId: RESERVATION_REQUEST_ID }
            : options.metadata,
        mode: options.mode ?? "payment",
        object: options.objectType ?? "checkout.session",
        payment_status: options.paymentStatus ?? "paid",
      },
    },
    id: options.eventId ?? "evt_test_webhook",
    object: "event",
    type: options.eventType ?? "checkout.session.completed",
  });
}

function createSignature(
  rawBody: string,
  options: { secret?: string; timestamp?: number } = {},
) {
  return stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret: options.secret ?? WEBHOOK_SECRET_PLACEHOLDER,
    timestamp: options.timestamp,
  });
}

async function classifySignedPayload(
  payloadOptions: EventPayloadOptions = {},
  loadRequests: () => Promise<ReservationRequestRecord[]> = async () => [
    acceptedRequest,
  ],
) {
  const rawBody = createEventPayload(payloadOptions);

  return classifyStripeWebhook({
    constructEvent,
    loadRequests,
    rawBody,
    signature: createSignature(rawBody),
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });
}

test("verifies a signed paid checkout.session.completed event", async () => {
  const result = await classifySignedPayload();

  assert.deepEqual(result, {
    eventId: "evt_test_webhook",
    eventType: "checkout.session.completed",
    httpStatus: 200,
    kind: "verified_payment",
    reservationRequestId: RESERVATION_REQUEST_ID,
  });
});

test("verifies a signed paid checkout.session.async_payment_succeeded event", async () => {
  const result = await classifySignedPayload({
    eventType: "checkout.session.async_payment_succeeded",
  });

  assert.equal(result.kind, "verified_payment");
  assert.equal(result.httpStatus, 200);
});

test("returns 400 when Stripe-Signature is missing", async () => {
  const result = await classifyStripeWebhook({
    constructEvent,
    loadRequests: async () => [acceptedRequest],
    rawBody: createEventPayload(),
    signature: null,
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });

  assert.deepEqual(result, {
    httpStatus: 400,
    kind: "invalid_request",
    reason: "missing_signature",
  });
});

test("returns 503 when webhook configuration is missing", async () => {
  const rawBody = createEventPayload();

  assert.deepEqual(
    await classifyStripeWebhook({
      constructEvent,
      rawBody,
      signature: createSignature(rawBody),
      webhookSecret: null,
    }),
    {
      httpStatus: 503,
      kind: "unavailable",
      reason: "missing_configuration",
    },
  );
});

test("returns 400 for an invalid signature", async () => {
  const rawBody = createEventPayload();
  const result = await classifyStripeWebhook({
    constructEvent,
    rawBody,
    signature: createSignature(rawBody, {
      secret: "whsec_different_placeholder",
    }),
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });

  assert.equal(result.httpStatus, 400);
  assert.equal(result.kind, "invalid_request");
});

test("returns 400 when a signed payload is altered", async () => {
  const rawBody = createEventPayload();
  const signature = createSignature(rawBody);
  const alteredBody = rawBody.replace('"payment_status":"paid"', '"payment_status":"unpaid"');
  const result = await classifyStripeWebhook({
    constructEvent,
    rawBody: alteredBody,
    signature,
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });

  assert.equal(result.httpStatus, 400);
  assert.equal(result.kind, "invalid_request");
});

test("returns 400 for a stale signature outside the SDK tolerance", async () => {
  const rawBody = createEventPayload();
  const result = await classifyStripeWebhook({
    constructEvent,
    rawBody,
    signature: createSignature(rawBody, {
      timestamp: Math.floor(Date.now() / 1000) - 600,
    }),
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });

  assert.equal(result.httpStatus, 400);
  assert.equal(result.kind, "invalid_request");
});

test("duplicate valid delivery returns the same result with no mutation", async () => {
  const rawBody = createEventPayload();
  const signature = createSignature(rawBody);
  const originalRequest = structuredClone(acceptedRequest);
  let lookupCount = 0;
  const loadRequests = async () => {
    lookupCount += 1;
    return [acceptedRequest];
  };
  const input = {
    constructEvent,
    loadRequests,
    rawBody,
    signature,
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  };

  const firstResult = await classifyStripeWebhook(input);
  const secondResult = await classifyStripeWebhook(input);

  assert.deepEqual(secondResult, firstResult);
  assert.equal(lookupCount, 2);
  assert.deepEqual(acceptedRequest, originalRequest);
});

test("irrelevant verified events return 200 without reservation lookup", async () => {
  let lookupCount = 0;
  const result = await classifySignedPayload(
    { eventType: "customer.created", objectType: "customer" },
    async () => {
      lookupCount += 1;
      return [acceptedRequest];
    },
  );

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
  assert.equal(lookupCount, 0);
});

test("supported events with a non-Checkout object are ignored", async () => {
  let lookupCount = 0;
  const result = await classifySignedPayload(
    { objectType: "payment_intent" },
    async () => {
      lookupCount += 1;
      return [acceptedRequest];
    },
  );

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
  assert.equal(lookupCount, 0);
});

test("unpaid completion is a no-op and a later async paid event verifies", async () => {
  const unpaidResult = await classifySignedPayload({ paymentStatus: "unpaid" });
  const paidResult = await classifySignedPayload({
    eventId: "evt_test_async_paid",
    eventType: "checkout.session.async_payment_succeeded",
  });

  assert.equal(unpaidResult.httpStatus, 200);
  assert.equal(unpaidResult.kind, "ignored");
  assert.equal(paidResult.kind, "verified_payment");
});

test("wrong Checkout mode returns a 200 no-op", async () => {
  const result = await classifySignedPayload({ mode: "subscription" });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("missing metadata reservation ID returns a 200 no-op", async () => {
  const result = await classifySignedPayload({ metadata: {} });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("missing client_reference_id returns a 200 no-op", async () => {
  const result = await classifySignedPayload({ clientReferenceId: null });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("mismatched reservation identifiers return a 200 no-op", async () => {
  const result = await classifySignedPayload({
    clientReferenceId: "different-id",
  });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("unknown reservation returns a 200 no-op", async () => {
  const result = await classifySignedPayload({}, async () => []);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("reservation that is not accepted returns a 200 no-op", async () => {
  const result = await classifySignedPayload({}, async () => [pendingRequest]);

  assert.equal(result.httpStatus, 200);
  assert.equal(result.kind, "ignored");
});

test("unreadable reservation storage returns 500", async () => {
  const result = await classifySignedPayload({}, async () => {
    throw new Error("store unavailable");
  });

  assert.deepEqual(result, {
    httpStatus: 500,
    kind: "unavailable",
    reason: "reservation_store_unreadable",
  });
});

test("browser-only returned state cannot establish payment truth", async () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("returned"),
  );
  const result = await classifyStripeWebhook({
    constructEvent,
    rawBody: JSON.stringify({ checkout: "returned" }),
    signature: null,
    webhookSecret: WEBHOOK_SECRET_PLACEHOLDER,
  });

  assert.match(pageContent.notice ?? "", /does not verify or confirm payment/i);
  assert.equal(result.httpStatus, 400);
  assert.equal(result.kind, "invalid_request");
});
