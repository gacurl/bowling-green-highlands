import type Stripe from "stripe";
import {
  markReservationCheckoutSessionRetryable,
  markReservationRequestPaid,
  readReservationRequests,
} from "./reservation-requests";
import type {
  MarkReservationCheckoutSessionRetryableResult,
  MarkReservationRequestPaidResult,
  ReservationRequestRecord,
} from "./reservation-requests";

export const SUPPORTED_STRIPE_PAYMENT_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export type SupportedStripePaymentEventType =
  (typeof SUPPORTED_STRIPE_PAYMENT_EVENT_TYPES)[number];

const STRIPE_PAYMENT_FAILURE_EVENT_TYPES = [
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
] as const;

type StripePaymentFailureEventType =
  (typeof STRIPE_PAYMENT_FAILURE_EVENT_TYPES)[number];

export type StripeWebhookEventConstructor = (
  rawBody: string,
  signature: string,
  webhookSecret: string,
) => Stripe.Event;

type RequestLoader = () => Promise<ReservationRequestRecord[]>;
type PaymentMarker = (
  reservationRequestId: string,
  stripeCheckoutSessionId: string,
) => Promise<MarkReservationRequestPaidResult>;
type RetryableSessionMarker = (
  reservationRequestId: string,
  stripeCheckoutSessionId: string,
) => Promise<MarkReservationCheckoutSessionRetryableResult>;

type ClassifyStripeWebhookInput = {
  constructEvent: StripeWebhookEventConstructor | null;
  loadRequests?: RequestLoader;
  rawBody: string;
  signature: string | null;
  webhookSecret: string | null | undefined;
};

type ProcessStripeWebhookInput = ClassifyStripeWebhookInput & {
  markPaid?: PaymentMarker;
  markRetryable?: RetryableSessionMarker;
};

type IgnoredStripeWebhookReason =
  | "already_paid"
  | "invalid_reservation_reference"
  | "not_accepted"
  | "not_found"
  | "not_paid"
  | "not_payment_mode"
  | "not_checkout_session"
  | "stale_session"
  | "unsupported_event";

export type StripeWebhookClassification =
  | {
      eventId: string;
      eventType: SupportedStripePaymentEventType;
      httpStatus: 200;
      kind: "verified_payment";
      reservationRequestId: string;
      stripeCheckoutSessionId: string;
    }
  | {
      eventId: string;
      eventType: StripePaymentFailureEventType;
      httpStatus: 200;
      kind: "verified_retryable_session";
      reason: "payment_failed" | "session_expired";
      reservationRequestId: string;
      stripeCheckoutSessionId: string;
    }
  | {
      eventId: string | null;
      eventType: string | null;
      httpStatus: 200;
      kind: "ignored";
      reason: IgnoredStripeWebhookReason;
    }
  | {
      httpStatus: 400;
      kind: "invalid_request";
      reason: "invalid_signature" | "missing_signature";
    }
  | {
      httpStatus: 500 | 503;
      kind: "unavailable";
      reason:
        | "missing_configuration"
        | "reservation_store_unreadable"
        | "reservation_store_unwritable";
    };

function isSupportedPaymentEventType(
  eventType: string,
): eventType is SupportedStripePaymentEventType {
  return SUPPORTED_STRIPE_PAYMENT_EVENT_TYPES.some(
    (supportedEventType) => supportedEventType === eventType,
  );
}

function isPaymentFailureEventType(
  eventType: string,
): eventType is StripePaymentFailureEventType {
  return STRIPE_PAYMENT_FAILURE_EVENT_TYPES.some(
    (failureEventType) => failureEventType === eventType,
  );
}

function isCheckoutSession(value: unknown): value is Stripe.Checkout.Session {
  return (
    typeof value === "object" &&
    value !== null &&
    "object" in value &&
    value.object === "checkout.session"
  );
}

function ignoredClassification(
  event: Stripe.Event,
  reason: IgnoredStripeWebhookReason,
): StripeWebhookClassification {
  return {
    eventId: typeof event.id === "string" ? event.id : null,
    eventType: typeof event.type === "string" ? event.type : null,
    httpStatus: 200,
    kind: "ignored",
    reason,
  };
}

export async function classifyStripeWebhook({
  constructEvent,
  loadRequests = readReservationRequests,
  rawBody,
  signature,
  webhookSecret,
}: ClassifyStripeWebhookInput): Promise<StripeWebhookClassification> {
  const normalizedWebhookSecret = webhookSecret?.trim();

  if (!constructEvent || !normalizedWebhookSecret) {
    return {
      httpStatus: 503,
      kind: "unavailable",
      reason: "missing_configuration",
    };
  }

  if (!signature) {
    return {
      httpStatus: 400,
      kind: "invalid_request",
      reason: "missing_signature",
    };
  }

  let event: Stripe.Event;

  try {
    event = constructEvent(rawBody, signature, normalizedWebhookSecret);
  } catch {
    return {
      httpStatus: 400,
      kind: "invalid_request",
      reason: "invalid_signature",
    };
  }

  const isPaymentEvent = isSupportedPaymentEventType(event.type);
  const isFailureEvent = isPaymentFailureEventType(event.type);

  if (!isPaymentEvent && !isFailureEvent) {
    return ignoredClassification(event, "unsupported_event");
  }

  const session = event.data.object;

  if (!isCheckoutSession(session)) {
    return ignoredClassification(event, "not_checkout_session");
  }

  if (session.mode !== "payment") {
    return ignoredClassification(event, "not_payment_mode");
  }

  if (isPaymentEvent && session.payment_status !== "paid") {
    return ignoredClassification(event, "not_paid");
  }

  if (isFailureEvent && session.payment_status === "paid") {
    return ignoredClassification(event, "already_paid");
  }

  const metadataRequestId = session.metadata?.reservationRequestId?.trim();
  const clientReferenceId = session.client_reference_id?.trim();
  const stripeCheckoutSessionId = session.id?.trim();

  if (
    !metadataRequestId ||
    !clientReferenceId ||
    !stripeCheckoutSessionId ||
    clientReferenceId !== metadataRequestId
  ) {
    return ignoredClassification(event, "invalid_reservation_reference");
  }

  let requests: ReservationRequestRecord[];

  try {
    requests = await loadRequests();
  } catch {
    return {
      httpStatus: 500,
      kind: "unavailable",
      reason: "reservation_store_unreadable",
    };
  }

  const reservationRequest = requests.find(
    (request) => request.id === metadataRequestId,
  );

  if (!reservationRequest) {
    return ignoredClassification(event, "not_found");
  }

  if (reservationRequest.status !== "accepted") {
    return ignoredClassification(event, "not_accepted");
  }

  if (isFailureEvent) {
    const eventType = event.type as StripePaymentFailureEventType;

    return {
      eventId: event.id,
      eventType,
      httpStatus: 200,
      kind: "verified_retryable_session",
      reason:
        eventType === "checkout.session.async_payment_failed"
          ? "payment_failed"
          : "session_expired",
      reservationRequestId: reservationRequest.id,
      stripeCheckoutSessionId,
    };
  }

  const eventType = event.type as SupportedStripePaymentEventType;

  return {
    eventId: event.id,
    eventType,
    httpStatus: 200,
    kind: "verified_payment",
    reservationRequestId: reservationRequest.id,
    stripeCheckoutSessionId,
  };
}

function ignoredFromVerified(
  classification: Extract<
    StripeWebhookClassification,
    { kind: "verified_payment" | "verified_retryable_session" }
  >,
  reason: "already_paid" | "not_accepted" | "not_found" | "stale_session",
): StripeWebhookClassification {
  return {
    eventId: classification.eventId,
    eventType: classification.eventType,
    httpStatus: 200,
    kind: "ignored",
    reason,
  };
}

export async function processStripeWebhook({
  markPaid = markReservationRequestPaid,
  markRetryable = markReservationCheckoutSessionRetryable,
  ...classificationInput
}: ProcessStripeWebhookInput): Promise<StripeWebhookClassification> {
  const classification = await classifyStripeWebhook(classificationInput);

  if (classification.kind === "verified_payment") {
    let paymentUpdate: MarkReservationRequestPaidResult;

    try {
      paymentUpdate = await markPaid(
        classification.reservationRequestId,
        classification.stripeCheckoutSessionId,
      );
    } catch {
      return {
        httpStatus: 500,
        kind: "unavailable",
        reason: "reservation_store_unwritable",
      };
    }

    if (
      paymentUpdate === "not_found" ||
      paymentUpdate === "not_accepted" ||
      paymentUpdate === "stale_session"
    ) {
      return ignoredFromVerified(classification, paymentUpdate);
    }

    return classification;
  }

  if (classification.kind === "verified_retryable_session") {
    let retryableUpdate: MarkReservationCheckoutSessionRetryableResult;

    try {
      retryableUpdate = await markRetryable(
        classification.reservationRequestId,
        classification.stripeCheckoutSessionId,
      );
    } catch {
      return {
        httpStatus: 500,
        kind: "unavailable",
        reason: "reservation_store_unwritable",
      };
    }

    if (
      retryableUpdate === "not_found" ||
      retryableUpdate === "not_accepted" ||
      retryableUpdate === "stale_session" ||
      retryableUpdate === "already_paid"
    ) {
      return ignoredFromVerified(classification, retryableUpdate);
    }
  }

  return classification;
}
