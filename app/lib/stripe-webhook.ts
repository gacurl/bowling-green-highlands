import type Stripe from "stripe";
import {
  markReservationRequestPaid,
  readReservationRequests,
} from "./reservation-requests";
import type {
  MarkReservationRequestPaidResult,
  ReservationRequestRecord,
} from "./reservation-requests";

export const SUPPORTED_STRIPE_PAYMENT_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export type SupportedStripePaymentEventType =
  (typeof SUPPORTED_STRIPE_PAYMENT_EVENT_TYPES)[number];

export type StripeWebhookEventConstructor = (
  rawBody: string,
  signature: string,
  webhookSecret: string,
) => Stripe.Event;

type RequestLoader = () => Promise<ReservationRequestRecord[]>;
type PaymentMarker = (
  reservationRequestId: string,
) => Promise<MarkReservationRequestPaidResult>;

type ClassifyStripeWebhookInput = {
  constructEvent: StripeWebhookEventConstructor | null;
  loadRequests?: RequestLoader;
  rawBody: string;
  signature: string | null;
  webhookSecret: string | null | undefined;
};

type ProcessStripeWebhookInput = ClassifyStripeWebhookInput & {
  markPaid?: PaymentMarker;
};

export type StripeWebhookClassification =
  | {
      eventId: string;
      eventType: SupportedStripePaymentEventType;
      httpStatus: 200;
      kind: "verified_payment";
      reservationRequestId: string;
    }
  | {
      eventId: string | null;
      eventType: string | null;
      httpStatus: 200;
      kind: "ignored";
      reason:
        | "invalid_reservation_reference"
        | "not_accepted"
        | "not_found"
        | "not_paid"
        | "not_payment_mode"
        | "not_checkout_session"
        | "unsupported_event";
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

function isCheckoutSession(value: unknown): value is Stripe.Checkout.Session {
  return (
    typeof value === "object" &&
    value !== null &&
    "object" in value &&
    value.object === "checkout.session"
  );
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

  if (!isSupportedPaymentEventType(event.type)) {
    return {
      eventId: typeof event.id === "string" ? event.id : null,
      eventType: typeof event.type === "string" ? event.type : null,
      httpStatus: 200,
      kind: "ignored",
      reason: "unsupported_event",
    };
  }

  const session = event.data.object;

  if (!isCheckoutSession(session)) {
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "not_checkout_session",
    };
  }

  if (session.mode !== "payment") {
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "not_payment_mode",
    };
  }

  if (session.payment_status !== "paid") {
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "not_paid",
    };
  }

  const metadataRequestId = session.metadata?.reservationRequestId?.trim();
  const clientReferenceId = session.client_reference_id?.trim();

  if (
    !metadataRequestId ||
    !clientReferenceId ||
    clientReferenceId !== metadataRequestId
  ) {
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "invalid_reservation_reference",
    };
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
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "not_found",
    };
  }

  if (reservationRequest.status !== "accepted") {
    return {
      eventId: event.id,
      eventType: event.type,
      httpStatus: 200,
      kind: "ignored",
      reason: "not_accepted",
    };
  }

  return {
    eventId: event.id,
    eventType: event.type,
    httpStatus: 200,
    kind: "verified_payment",
    reservationRequestId: reservationRequest.id,
  };
}

export async function processStripeWebhook({
  markPaid = markReservationRequestPaid,
  ...classificationInput
}: ProcessStripeWebhookInput): Promise<StripeWebhookClassification> {
  const classification = await classifyStripeWebhook(classificationInput);

  if (classification.kind !== "verified_payment") {
    return classification;
  }

  let paymentUpdate: MarkReservationRequestPaidResult;

  try {
    paymentUpdate = await markPaid(classification.reservationRequestId);
  } catch {
    return {
      httpStatus: 500,
      kind: "unavailable",
      reason: "reservation_store_unwritable",
    };
  }

  if (paymentUpdate === "not_found" || paymentUpdate === "not_accepted") {
    return {
      eventId: classification.eventId,
      eventType: classification.eventType,
      httpStatus: 200,
      kind: "ignored",
      reason: paymentUpdate === "not_found" ? "not_found" : "not_accepted",
    };
  }

  return classification;
}
