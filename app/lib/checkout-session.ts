import { createHash } from "node:crypto";
import {
  withLockedReservationCheckoutRequest,
  type ReservationCheckoutLockResult,
  type ReservationCheckoutOperation,
  type ReservationCheckoutOperationResult,
  type ReservationCheckoutRequest,
} from "./reservation-requests";

export type CheckoutSessionCreateParams = {
  cancel_url: string;
  client_reference_id: string;
  customer_email: string;
  line_items: [
    {
      price: string;
      quantity: 1;
    },
  ];
  metadata: {
    reservationRequestId: string;
  };
  mode: "payment";
  success_url: string;
};

export type StripeCheckoutSession = {
  id: string;
  payment_status: string;
  status: string | null;
  url: string | null;
};

export type CheckoutSessionCreator = (
  params: CheckoutSessionCreateParams,
  idempotencyKey: string,
) => Promise<StripeCheckoutSession>;

export type CheckoutSessionRetriever = (
  sessionId: string,
) => Promise<StripeCheckoutSession>;

export type CheckoutSessionResult =
  | {
      kind: "created";
      url: string;
    }
  | {
      kind: "unavailable";
      reason:
        | "already_paid"
        | "checkout_failed"
        | "missing_config"
        | "not_accepted"
        | "not_found"
        | "payment_pending"
        | "unreadable";
    };

type CheckoutRequestLocker = <Result>(
  requestId: string,
  operation: ReservationCheckoutOperation<Result>,
) => Promise<ReservationCheckoutLockResult<Result>>;

type CreateReservationCheckoutSessionInput = {
  appUrl: string | null | undefined;
  createSession: CheckoutSessionCreator | null;
  lockRequest?: CheckoutRequestLocker;
  priceId: string | null | undefined;
  requestId: string;
  retrieveSession: CheckoutSessionRetriever | null;
};

type GetCheckoutReadinessInput = {
  appUrl: string | null | undefined;
  hasStripeConfig: boolean;
};

export type CheckoutReadiness = {
  appOrigin: string;
};

function unavailable(
  reason: Extract<CheckoutSessionResult, { kind: "unavailable" }>["reason"],
): CheckoutSessionResult {
  return {
    kind: "unavailable",
    reason,
  };
}

function resultOnly(
  result: CheckoutSessionResult,
): ReservationCheckoutOperationResult<CheckoutSessionResult> {
  return { result };
}

function getCheckoutIdempotencyKey(
  requestId: string,
  predecessorSessionId: string | null,
) {
  const attemptIdentity = predecessorSessionId
    ? `${requestId}\0after\0${predecessorSessionId}`
    : `${requestId}\0initial`;

  return `bgh-checkout-v1-${createHash("sha256")
    .update(attemptIdentity)
    .digest("hex")}`;
}

export function getCheckoutReadiness({
  appUrl,
  hasStripeConfig,
}: GetCheckoutReadinessInput): CheckoutReadiness | null {
  if (!hasStripeConfig) {
    return null;
  }

  const trimmedAppUrl = appUrl?.trim();

  if (!trimmedAppUrl) {
    return null;
  }

  const originMatch = /^(https?):\/\/([^/?#]+)\/?$/i.exec(trimmedAppUrl);

  if (
    !originMatch ||
    originMatch[2].includes("@") ||
    trimmedAppUrl.includes("\\")
  ) {
    return null;
  }

  let appUrlValue: URL;

  try {
    appUrlValue = new URL(trimmedAppUrl);
  } catch {
    return null;
  }

  if (
    (appUrlValue.protocol !== "http:" && appUrlValue.protocol !== "https:") ||
    appUrlValue.username !== "" ||
    appUrlValue.password !== "" ||
    appUrlValue.pathname !== "/" ||
    appUrlValue.search !== "" ||
    appUrlValue.hash !== ""
  ) {
    return null;
  }

  return {
    appOrigin: appUrlValue.origin,
  };
}

function getCreatedSessionResult(
  session: StripeCheckoutSession,
): CheckoutSessionResult {
  if (
    session.status === "open" &&
    session.payment_status === "unpaid" &&
    session.url
  ) {
    return {
      kind: "created",
      url: session.url,
    };
  }

  if (session.status === "complete" || session.payment_status === "paid") {
    return unavailable("payment_pending");
  }

  return unavailable("checkout_failed");
}

async function createAndPersistCheckoutSession(
  request: ReservationCheckoutRequest,
  predecessorSessionId: string | null,
  paymentUrl: string,
  priceId: string,
  createSession: CheckoutSessionCreator,
): Promise<ReservationCheckoutOperationResult<CheckoutSessionResult>> {
  let session: StripeCheckoutSession;

  try {
    session = await createSession(
      {
        cancel_url: `${paymentUrl}?checkout=cancelled`,
        client_reference_id: request.id,
        customer_email: request.guestEmail,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          reservationRequestId: request.id,
        },
        mode: "payment",
        success_url: `${paymentUrl}?checkout=returned`,
      },
      getCheckoutIdempotencyKey(request.id, predecessorSessionId),
    );
  } catch {
    return resultOnly(unavailable("checkout_failed"));
  }

  const sessionId = session.id.trim();

  if (!sessionId) {
    return resultOnly(unavailable("checkout_failed"));
  }

  return {
    result: getCreatedSessionResult(session),
    sessionUpdate: {
      id: sessionId,
      retryable: false,
    },
  };
}

export async function createReservationCheckoutSession({
  appUrl,
  createSession,
  lockRequest = withLockedReservationCheckoutRequest,
  priceId,
  requestId,
  retrieveSession,
}: CreateReservationCheckoutSessionInput): Promise<CheckoutSessionResult> {
  const trimmedPriceId = priceId?.trim();
  const checkoutReadiness = getCheckoutReadiness({
    appUrl,
    hasStripeConfig:
      createSession !== null &&
      retrieveSession !== null &&
      Boolean(trimmedPriceId),
  });

  if (
    !checkoutReadiness ||
    !createSession ||
    !retrieveSession ||
    !trimmedPriceId
  ) {
    return unavailable("missing_config");
  }

  const paymentUrl = `${checkoutReadiness.appOrigin}/pay/${encodeURIComponent(requestId)}`;
  let lockedResult: ReservationCheckoutLockResult<CheckoutSessionResult>;

  try {
    lockedResult = await lockRequest(requestId, async (reservationRequest) => {
      if (reservationRequest.status !== "accepted") {
        return resultOnly(unavailable("not_accepted"));
      }

      if (reservationRequest.paymentStatus === "paid") {
        return resultOnly(unavailable("already_paid"));
      }

      const currentSessionId = reservationRequest.stripeCheckoutSessionId;

      if (
        !currentSessionId ||
        reservationRequest.stripeCheckoutSessionRetryable
      ) {
        return createAndPersistCheckoutSession(
          reservationRequest,
          currentSessionId,
          paymentUrl,
          trimmedPriceId,
          createSession,
        );
      }

      let currentSession: StripeCheckoutSession;

      try {
        currentSession = await retrieveSession(currentSessionId);
      } catch {
        return resultOnly(unavailable("checkout_failed"));
      }

      if (currentSession.id !== currentSessionId) {
        return resultOnly(unavailable("checkout_failed"));
      }

      if (
        currentSession.status === "open" &&
        currentSession.payment_status === "unpaid" &&
        currentSession.url
      ) {
        return resultOnly({
          kind: "created",
          url: currentSession.url,
        });
      }

      if (
        currentSession.status === "complete" ||
        currentSession.payment_status === "paid"
      ) {
        return resultOnly(unavailable("payment_pending"));
      }

      if (
        currentSession.status === "expired" &&
        currentSession.payment_status === "unpaid"
      ) {
        return createAndPersistCheckoutSession(
          reservationRequest,
          currentSessionId,
          paymentUrl,
          trimmedPriceId,
          createSession,
        );
      }

      return resultOnly(unavailable("checkout_failed"));
    });
  } catch {
    return unavailable("unreadable");
  }

  if (lockedResult.kind === "not_found") {
    return unavailable("not_found");
  }

  return lockedResult.result;
}
