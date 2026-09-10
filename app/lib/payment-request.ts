import { readReservationRequests } from "./reservation-requests";
import type { ReservationRequestRecord } from "./reservation-requests";

export type PaymentRequestState =
  | {
      kind: "available";
      request: ReservationRequestRecord;
    }
  | {
      kind: "unavailable";
      reason: "missing_config" | "not_accepted" | "not_found" | "unreadable";
    };

type RequestLoader = () => Promise<ReservationRequestRecord[]>;

export async function getPaymentRequestState(
  requestId: string,
  hasStripeConfig: boolean,
  loadRequests: RequestLoader = readReservationRequests,
): Promise<PaymentRequestState> {
  if (!hasStripeConfig) {
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

  const request = requests.find((record) => record.id === requestId);

  if (!request) {
    return {
      kind: "unavailable",
      reason: "not_found",
    };
  }

  if (request.status !== "accepted") {
    return {
      kind: "unavailable",
      reason: "not_accepted",
    };
  }

  return {
    kind: "available",
    request,
  };
}
