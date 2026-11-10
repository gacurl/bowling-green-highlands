import { readReservationRequests } from "./reservation-requests";
import type { ReservationRequestRecord } from "./reservation-requests";

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

export type CheckoutSessionCreator = (
  params: CheckoutSessionCreateParams,
) => Promise<{ url: string | null }>;

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
        | "unreadable";
    };

type RequestLoader = () => Promise<ReservationRequestRecord[]>;

type CreateReservationCheckoutSessionInput = {
  appUrl: string | null | undefined;
  createSession: CheckoutSessionCreator | null;
  priceId: string | null | undefined;
  requestId: string;
  loadRequests?: RequestLoader;
};

type GetCheckoutReadinessInput = {
  appUrl: string | null | undefined;
  hasStripeConfig: boolean;
};

export type CheckoutReadiness = {
  appOrigin: string;
};

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

export async function createReservationCheckoutSession({
  appUrl,
  createSession,
  priceId,
  requestId,
  loadRequests = readReservationRequests,
}: CreateReservationCheckoutSessionInput): Promise<CheckoutSessionResult> {
  const trimmedPriceId = priceId?.trim();
  const checkoutReadiness = getCheckoutReadiness({
    appUrl,
    hasStripeConfig: createSession !== null && Boolean(trimmedPriceId),
  });

  if (!checkoutReadiness || !createSession || !trimmedPriceId) {
    return {
      kind: "unavailable",
      reason: "missing_config",
    };
  }

  let requests: ReservationRequestRecord[];

  try {
    requests = await loadRequests();
  } catch {
    return {
      kind: "unavailable",
      reason: "unreadable",
    };
  }

  const reservationRequest = requests.find((request) => request.id === requestId);

  if (!reservationRequest) {
    return {
      kind: "unavailable",
      reason: "not_found",
    };
  }

  if (reservationRequest.status !== "accepted") {
    return {
      kind: "unavailable",
      reason: "not_accepted",
    };
  }

  if (reservationRequest.paymentStatus === "paid") {
    return {
      kind: "unavailable",
      reason: "already_paid",
    };
  }

  const paymentUrl = `${checkoutReadiness.appOrigin}/pay/${encodeURIComponent(requestId)}`;
  let session: { url: string | null };

  try {
    session = await createSession({
      cancel_url: `${paymentUrl}?checkout=cancelled`,
      client_reference_id: reservationRequest.id,
      customer_email: reservationRequest.guestEmail,
      line_items: [
        {
          price: trimmedPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        reservationRequestId: reservationRequest.id,
      },
      mode: "payment",
      success_url: `${paymentUrl}?checkout=returned`,
    });
  } catch {
    return {
      kind: "unavailable",
      reason: "checkout_failed",
    };
  }

  if (!session.url) {
    return {
      kind: "unavailable",
      reason: "checkout_failed",
    };
  }

  return {
    kind: "created",
    url: session.url,
  };
}
