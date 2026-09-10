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

function normalizeAppUrl(appUrl: string | null | undefined) {
  const trimmedAppUrl = appUrl?.trim();

  if (!trimmedAppUrl) {
    return null;
  }

  return trimmedAppUrl.replace(/\/+$/, "");
}

export async function createReservationCheckoutSession({
  appUrl,
  createSession,
  priceId,
  requestId,
  loadRequests = readReservationRequests,
}: CreateReservationCheckoutSessionInput): Promise<CheckoutSessionResult> {
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const trimmedPriceId = priceId?.trim();

  if (!createSession || !normalizedAppUrl || !trimmedPriceId) {
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

  const paymentUrl = `${normalizedAppUrl}/pay/${encodeURIComponent(requestId)}`;
  const session = await createSession({
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
