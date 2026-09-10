export type CheckoutReturnState = "cancelled" | "returned" | null;

export type PaymentPageContent = {
  description: string;
  notice: string | null;
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
): PaymentPageContent {
  if (!paymentAvailable) {
    return {
      notice: null,
      title: "Payment is not available.",
      description:
        "Payment links are only available after Bowling Green Highlands accepts a request.",
    };
  }

  if (checkoutReturnState === "cancelled") {
    return {
      notice: "Payment was not completed. You can try again through Stripe.",
      title: "Payment was not completed.",
      description: "You can try again securely through Stripe when you are ready.",
    };
  }

  if (checkoutReturnState === "returned") {
    return {
      notice:
        "You returned from Stripe. This page does not verify or confirm payment.",
      title: "You returned from Stripe.",
      description:
        "Bowling Green Highlands will verify payment separately before relying on it.",
    };
  }

  return {
    notice: null,
    title: "Complete your payment.",
    description: "This accepted request is ready for secure payment through Stripe.",
  };
}
