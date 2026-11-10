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
    return NextResponse.redirect(
      new URL(`/pay/${requestId}?checkout=unavailable`, requestUrl),
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
      ? (sessionParams) =>
          stripeCheckout.stripe.checkout.sessions.create(sessionParams)
      : null,
    priceId: stripeCheckout?.priceId,
    requestId,
  });

  return createCheckoutRedirectResponse(request.url, requestId, checkoutResult);
}
