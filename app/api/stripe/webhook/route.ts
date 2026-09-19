import { getStripeCheckoutClient } from "../../../lib/stripe-checkout";
import { getStripeWebhookSecret } from "../../../lib/stripe-config";
import { processStripeWebhook } from "../../../lib/stripe-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return new Response(null, { status: 400 });
  }

  const stripeCheckout = getStripeCheckoutClient();
  const webhookSecret = getStripeWebhookSecret();
  const classification = await processStripeWebhook({
    constructEvent: stripeCheckout
      ? (payload, signature, secret) =>
          stripeCheckout.stripe.webhooks.constructEvent(
            payload,
            signature,
            secret,
          )
      : null,
    rawBody,
    signature: request.headers.get("Stripe-Signature"),
    webhookSecret,
  });

  return new Response(null, { status: classification.httpStatus });
}
