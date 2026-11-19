import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase } from "../../lib/test-support/postgres-test-database";
import {
  createReservationCheckoutSession,
  getCheckoutReadiness,
  type CheckoutSessionCreateParams,
  type StripeCheckoutSession,
} from "./checkout-session";
import {
  createReservationRequestRecord,
  readReservationRequests,
  updateReservationRequestStatus,
  withLockedReservationCheckoutRequest,
} from "./reservation-requests";
import type {
  ReservationCheckoutLockResult,
  ReservationCheckoutOperation,
  ReservationCheckoutRequest,
} from "./reservation-requests";

const acceptedRequest: ReservationCheckoutRequest = {
  guestEmail: "accepted@example.com",
  id: "accepted-id",
  paymentStatus: "unpaid",
  status: "accepted",
  stripeCheckoutSessionId: null,
  stripeCheckoutSessionRetryable: false,
};

const pendingRequest: ReservationCheckoutRequest = {
  ...acceptedRequest,
  guestEmail: "pending@example.com",
  id: "pending-id",
  status: "pending",
};

const declinedRequest: ReservationCheckoutRequest = {
  ...acceptedRequest,
  guestEmail: "declined@example.com",
  id: "declined-id",
  status: "declined",
};

function openSession(
  id = "cs_test_checkout",
  url = "https://checkout.stripe.test/session",
): StripeCheckoutSession {
  return {
    id,
    payment_status: "unpaid",
    status: "open",
    url,
  };
}

function createMemoryLocker(initialRequests: ReservationCheckoutRequest[]) {
  const requests = new Map(
    initialRequests.map((request) => [request.id, structuredClone(request)]),
  );

  return {
    getRequest(requestId: string) {
      return requests.get(requestId);
    },
    lockRequest: async <Result>(
      requestId: string,
      operation: ReservationCheckoutOperation<Result>,
    ): Promise<ReservationCheckoutLockResult<Result>> => {
      const request = requests.get(requestId);

      if (!request) {
        return { kind: "not_found" };
      }

      const operationResult = await operation(structuredClone(request));

      if (operationResult.sessionUpdate) {
        request.stripeCheckoutSessionId = operationResult.sessionUpdate.id;
        request.stripeCheckoutSessionRetryable =
          operationResult.sessionUpdate.retryable;
      }

      return {
        kind: "found",
        result: operationResult.result,
      };
    },
  };
}

function createFakeStripeSessionRecorder(
  sessionFactory: (
    callNumber: number,
    idempotencyKey: string,
  ) => StripeCheckoutSession = () => openSession(),
) {
  const calls: Array<{
    idempotencyKey: string;
    params: CheckoutSessionCreateParams;
  }> = [];

  return {
    calls,
    createSession: async (
      params: CheckoutSessionCreateParams,
      idempotencyKey: string,
    ) => {
      calls.push({ idempotencyKey, params });
      return sessionFactory(calls.length, idempotencyKey);
    },
  };
}

function createInput(
  locker = createMemoryLocker([acceptedRequest]),
  fakeStripe = createFakeStripeSessionRecorder(),
) {
  return {
    appUrl: "https://example.com",
    createSession: fakeStripe.createSession,
    lockRequest: locker.lockRequest,
    priceId: "price_configured",
    requestId: acceptedRequest.id,
    retrieveSession: async (sessionId: string) => openSession(sessionId),
  };
}

test("Checkout readiness requires complete Stripe configuration and an application origin", () => {
  assert.equal(
    getCheckoutReadiness({
      appUrl: "https://example.com",
      hasStripeConfig: false,
    }),
    null,
  );

  for (const appUrl of [undefined, null, "", "   "]) {
    assert.equal(
      getCheckoutReadiness({
        appUrl,
        hasStripeConfig: true,
      }),
      null,
    );
  }
});

test("Checkout readiness rejects malformed, unsafe, and non-origin URLs", () => {
  const invalidAppUrls = [
    "not-a-url",
    "https://",
    "javascript:alert(1)",
    "file:///tmp/bowling-green-highlands",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://@example.com",
    "https://example.com/path",
    "https://example.com/.",
    "https://example.com?checkout=returned",
    "https://example.com?",
    "https://example.com#payment",
    "https://example.com#",
  ];

  for (const appUrl of invalidAppUrls) {
    assert.equal(
      getCheckoutReadiness({
        appUrl,
        hasStripeConfig: true,
      }),
      null,
      appUrl,
    );
  }
});

test("Checkout readiness accepts and canonicalizes HTTP and HTTPS origins", () => {
  assert.deepEqual(
    getCheckoutReadiness({
      appUrl: " http://127.0.0.1:3000/ ",
      hasStripeConfig: true,
    }),
    {
      appOrigin: "http://127.0.0.1:3000",
    },
  );
  assert.deepEqual(
    getCheckoutReadiness({
      appUrl: "https://EXAMPLE.com:443/",
      hasStripeConfig: true,
    }),
    {
      appOrigin: "https://example.com",
    },
  );
  assert.deepEqual(
    getCheckoutReadiness({
      appUrl: "https://example.com:8443",
      hasStripeConfig: true,
    }),
    {
      appOrigin: "https://example.com:8443",
    },
  );
});

test("accepted unpaid request persists one Checkout Session before returning its URL", async () => {
  const locker = createMemoryLocker([acceptedRequest]);
  const fakeStripe = createFakeStripeSessionRecorder();
  const result = await createReservationCheckoutSession(
    createInput(locker, fakeStripe),
  );

  assert.deepEqual(result, {
    kind: "created",
    url: "https://checkout.stripe.test/session",
  });
  assert.equal(fakeStripe.calls.length, 1);
  assert.equal(
    locker.getRequest(acceptedRequest.id)?.stripeCheckoutSessionId,
    "cs_test_checkout",
  );
  assert.match(
    fakeStripe.calls[0].idempotencyKey,
    /^bgh-checkout-v1-[a-f0-9]{64}$/,
  );
});

test("stored email, configured Price ID, and reservation ID are sent to Stripe", async () => {
  const locker = createMemoryLocker([acceptedRequest]);
  const fakeStripe = createFakeStripeSessionRecorder();

  await createReservationCheckoutSession({
    ...createInput(locker, fakeStripe),
    appUrl: " https://EXAMPLE.com:443/ ",
  });

  assert.deepEqual(fakeStripe.calls[0].params, {
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

test("paid, pending, declined, and unknown reservations cannot create Checkout Sessions", async () => {
  const paidRequest: ReservationCheckoutRequest = {
    ...acceptedRequest,
    id: "paid-id",
    paymentStatus: "paid",
  };
  const locker = createMemoryLocker([
    paidRequest,
    pendingRequest,
    declinedRequest,
  ]);
  const fakeStripe = createFakeStripeSessionRecorder();
  const baseInput = createInput(locker, fakeStripe);

  for (const [requestId, reason] of [
    [paidRequest.id, "already_paid"],
    [pendingRequest.id, "not_accepted"],
    [declinedRequest.id, "not_accepted"],
    ["missing-id", "not_found"],
  ] as const) {
    assert.deepEqual(
      await createReservationCheckoutSession({ ...baseInput, requestId }),
      {
        kind: "unavailable",
        reason,
      },
    );
  }

  assert.equal(fakeStripe.calls.length, 0);
});

test("missing Stripe configuration fails closed before reservation access", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();
  let lockCount = 0;
  const lockRequest = async <Result>(
    requestId: string,
    operation: ReservationCheckoutOperation<Result>,
  ): Promise<ReservationCheckoutLockResult<Result>> => {
    void requestId;
    void operation;
    lockCount += 1;
    return { kind: "not_found" };
  };
  const validInput = {
    appUrl: "https://example.com",
    createSession: fakeStripe.createSession,
    lockRequest,
    priceId: "price_configured",
    requestId: "accepted-id",
    retrieveSession: async (sessionId: string) => openSession(sessionId),
  };

  for (const input of [
    { ...validInput, createSession: null },
    { ...validInput, retrieveSession: null },
    { ...validInput, priceId: "" },
    { ...validInput, appUrl: "" },
    { ...validInput, appUrl: "https://example.com/path" },
  ]) {
    assert.deepEqual(await createReservationCheckoutSession(input), {
      kind: "unavailable",
      reason: "missing_config",
    });
  }

  assert.equal(lockCount, 0);
  assert.equal(fakeStripe.calls.length, 0);
});

test("an existing open Checkout Session is reused without creating another", async () => {
  const currentRequest: ReservationCheckoutRequest = {
    ...acceptedRequest,
    stripeCheckoutSessionId: "cs_test_existing",
  };
  const locker = createMemoryLocker([currentRequest]);
  const fakeStripe = createFakeStripeSessionRecorder();
  let retrieveCount = 0;
  const result = await createReservationCheckoutSession({
    ...createInput(locker, fakeStripe),
    retrieveSession: async (sessionId) => {
      retrieveCount += 1;
      return openSession(sessionId, "https://checkout.stripe.test/existing");
    },
  });

  assert.deepEqual(result, {
    kind: "created",
    url: "https://checkout.stripe.test/existing",
  });
  assert.equal(retrieveCount, 1);
  assert.equal(fakeStripe.calls.length, 0);
});

test("paid, processing, and ambiguous Stripe Session states fail closed", async () => {
  const currentRequest: ReservationCheckoutRequest = {
    ...acceptedRequest,
    stripeCheckoutSessionId: "cs_test_existing",
  };

  for (const [session, reason] of [
    [
      {
        ...openSession("cs_test_existing", null as never),
        payment_status: "paid",
        status: "complete",
        url: null,
      },
      "payment_pending",
    ],
    [
      {
        ...openSession("cs_test_existing"),
        status: "complete",
        url: null,
      },
      "payment_pending",
    ],
    [
      {
        ...openSession("cs_test_existing"),
        payment_status: "paid",
        status: "expired",
        url: null,
      },
      "payment_pending",
    ],
    [
      {
        ...openSession("cs_test_existing"),
        status: null,
        url: null,
      },
      "checkout_failed",
    ],
  ] as const) {
    const locker = createMemoryLocker([currentRequest]);
    const fakeStripe = createFakeStripeSessionRecorder();

    assert.deepEqual(
      await createReservationCheckoutSession({
        ...createInput(locker, fakeStripe),
        retrieveSession: async () => session,
      }),
      {
        kind: "unavailable",
        reason,
      },
    );
    assert.equal(fakeStripe.calls.length, 0);
  }
});

test("expired and verified-failed Sessions create one persisted successor", async () => {
  for (const request of [
    {
      ...acceptedRequest,
      stripeCheckoutSessionId: "cs_test_expired",
    },
    {
      ...acceptedRequest,
      stripeCheckoutSessionId: "cs_test_failed",
      stripeCheckoutSessionRetryable: true,
    },
  ]) {
    const locker = createMemoryLocker([request]);
    const fakeStripe = createFakeStripeSessionRecorder(() =>
      openSession("cs_test_successor", "https://checkout.stripe.test/successor"),
    );
    let retrieveCount = 0;
    const result = await createReservationCheckoutSession({
      ...createInput(locker, fakeStripe),
      retrieveSession: async (sessionId) => {
        retrieveCount += 1;
        return {
          ...openSession(sessionId),
          status: "expired",
          url: null,
        };
      },
    });

    assert.deepEqual(result, {
      kind: "created",
      url: "https://checkout.stripe.test/successor",
    });
    assert.equal(fakeStripe.calls.length, 1);
    assert.equal(
      locker.getRequest(request.id)?.stripeCheckoutSessionId,
      "cs_test_successor",
    );
    assert.equal(
      locker.getRequest(request.id)?.stripeCheckoutSessionRetryable,
      false,
    );
    assert.equal(retrieveCount, request.stripeCheckoutSessionRetryable ? 0 : 1);
  }
});

test("Stripe exceptions and transaction failures never expose an unpersisted URL", async () => {
  const fakeStripe = createFakeStripeSessionRecorder();
  const failingLockRequest = async <Result>(
    _requestId: string,
    operation: ReservationCheckoutOperation<Result>,
  ): Promise<ReservationCheckoutLockResult<Result>> => {
    await operation(structuredClone(acceptedRequest));
    throw new Error("database commit failed");
  };

  assert.deepEqual(
    await createReservationCheckoutSession({
      ...createInput(),
      createSession: fakeStripe.createSession,
      lockRequest: failingLockRequest,
    }),
    {
      kind: "unavailable",
      reason: "unreadable",
    },
  );

  const firstKey = fakeStripe.calls[0].idempotencyKey;
  const retryLocker = createMemoryLocker([acceptedRequest]);
  const retryResult = await createReservationCheckoutSession({
    ...createInput(retryLocker),
    createSession: fakeStripe.createSession,
  });

  assert.equal(retryResult.kind, "created");
  assert.equal(fakeStripe.calls[1].idempotencyKey, firstKey);

  const throwingStripe = async () => {
    throw new Error("sensitive Stripe exception detail");
  };
  assert.deepEqual(
    await createReservationCheckoutSession({
      ...createInput(createMemoryLocker([acceptedRequest])),
      createSession: throwingStripe,
    }),
    {
      kind: "unavailable",
      reason: "checkout_failed",
    },
  );
});

test("concurrent database-backed requests create one Checkout Session and reuse its URL", async () => {
  const database = await createTestDatabase();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "concurrent@example.com",
      guestName: "Concurrent Guest",
      requestNotes: "",
      requestedDates: "2026-08-10 09:00 to 09:30",
    },
    database,
  );
  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", database),
    "updated",
  );

  const fakeStripe = createFakeStripeSessionRecorder(
    () => openSession("cs_test_concurrent", "https://checkout.stripe.test/concurrent"),
  );
  const lockRequest = <Result>(
    requestId: string,
    operation: ReservationCheckoutOperation<Result>,
  ) => withLockedReservationCheckoutRequest(requestId, operation, database);
  const input = {
    appUrl: "https://example.com",
    createSession: async (
      params: CheckoutSessionCreateParams,
      idempotencyKey: string,
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return fakeStripe.createSession(params, idempotencyKey);
    },
    lockRequest,
    priceId: "price_configured",
    requestId: request.id,
    retrieveSession: async (sessionId: string) =>
      openSession(sessionId, "https://checkout.stripe.test/concurrent"),
  };

  const results = await Promise.all([
    createReservationCheckoutSession(input),
    createReservationCheckoutSession(input),
  ]);

  assert.deepEqual(results, [
    {
      kind: "created",
      url: "https://checkout.stripe.test/concurrent",
    },
    {
      kind: "created",
      url: "https://checkout.stripe.test/concurrent",
    },
  ]);
  assert.equal(fakeStripe.calls.length, 1);
  assert.equal(
    (await readReservationRequests(database))[0].stripeCheckoutSessionId,
    "cs_test_concurrent",
  );
});
