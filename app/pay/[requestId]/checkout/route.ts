import { NextResponse } from "next/server";
import {
  createReservationCheckoutSession,
  type CheckoutSessionResult,
} from "../../../lib/checkout-session";
import { getStripeCheckoutClient } from "../../../lib/stripe-checkout";

type CheckoutRouteProps = {
  params: Promise<{ requestId: string }>;
};

export function createCheckoutRedirectResponse(
  requestUrl: string,
  requestId: string,
  checkoutResult: CheckoutSessionResult,
) {
  if (checkoutResult.kind !== "created") {
    const checkoutState =
      checkoutResult.reason === "payment_pending" ? "returned" : "unavailable";

    return NextResponse.redirect(
      new URL(`/pay/${requestId}?checkout=${checkoutState}`, requestUrl),
      303,
    );
  }

  return NextResponse.redirect(new URL(checkoutResult.url), 303);
}

export async function POST(request: Request, { params }: CheckoutRouteProps) {
  const { requestId } = await params;
  const stripeCheckout = getStripeCheckoutClient();
  const checkoutResult = await createReservationCheckoutSession({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    createSession: stripeCheckout
      ? (sessionParams, idempotencyKey) =>
          stripeCheckout.stripe.checkout.sessions.create(sessionParams, {
            idempotencyKey,
          })
      : null,
    priceId: stripeCheckout?.priceId,
    requestId,
    retrieveSession: stripeCheckout
      ? (sessionId) =>
          stripeCheckout.stripe.checkout.sessions.retrieve(sessionId)
      : null,
  });

  return createCheckoutRedirectResponse(request.url, requestId, checkoutResult);
}
