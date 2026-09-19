import type { ReservationPaymentStatus } from "./reservation-requests";

export type CheckoutReturnState = "cancelled" | "returned" | null;
export type PaymentPagePrimaryAction = "pay" | "refresh" | null;

export type PaymentPageContent = {
  description: string;
  notice: string | null;
  paymentStatusLabel: "Not yet verified" | "Paid" | null;
  primaryAction: PaymentPagePrimaryAction;
  reservationStatusLabel: "Accepted" | null;
  title: string;
};

export function getCheckoutReturnState(
  value: string | undefined,
): CheckoutReturnState {
  if (value === "cancelled" || value === "returned") {
    return value;
  }

  return null;
}

export function getPaymentPageContent(
  paymentAvailable: boolean,
  checkoutReturnState: CheckoutReturnState,
  paymentStatus: ReservationPaymentStatus | undefined = "unpaid",
): PaymentPageContent {
  if (!paymentAvailable) {
    return {
      notice: null,
      title: "Payment is not available.",
      description:
        "Payment links are only available after Bowling Green Highlands accepts a request.",
      paymentStatusLabel: null,
      primaryAction: null,
      reservationStatusLabel: null,
    };
  }

  if (paymentStatus === "paid") {
    return {
      description: "Your payment has been verified.",
      notice:
        "No further payment action is needed. Bowling Green Highlands will contact you with any next steps.",
      paymentStatusLabel: "Paid",
      primaryAction: null,
      reservationStatusLabel: "Accepted",
      title: "Payment received.",
    };
  }

  if (checkoutReturnState === "cancelled") {
    return {
      notice:
        "Payment was not completed. You can try again securely through Stripe when you are ready.",
      title: "Payment was not completed.",
      description: "Your reservation request remains accepted.",
      paymentStatusLabel: "Not yet verified",
      primaryAction: "pay",
      reservationStatusLabel: "Accepted",
    };
  }

  if (checkoutReturnState === "returned") {
    return {
      notice:
        "Returning from Stripe does not verify or confirm payment. Payment has not yet been verified. Refresh this page in a moment to check again.",
      title: "We’re verifying your payment.",
      description: "Returning from Stripe does not confirm payment.",
      paymentStatusLabel: "Not yet verified",
      primaryAction: "refresh",
      reservationStatusLabel: "Accepted",
    };
  }

  return {
    notice: null,
    title: "Complete your payment.",
    description: "This accepted request is ready for secure payment through Stripe.",
    paymentStatusLabel: "Not yet verified",
    primaryAction: "pay",
    reservationStatusLabel: "Accepted",
  };
}
