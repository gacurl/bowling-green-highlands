import { redirect } from "next/navigation";
import { createReservationCheckoutSession } from "../../../lib/checkout-session";
import { getStripeCheckoutClient } from "../../../lib/stripe-checkout";

type CheckoutRouteProps = {
  params: Promise<{ requestId: string }>;
};

export async function POST(_request: Request, { params }: CheckoutRouteProps) {
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

  if (checkoutResult.kind !== "created") {
    redirect(`/pay/${requestId}?checkout=unavailable`);
  }

  redirect(checkoutResult.url);
}
