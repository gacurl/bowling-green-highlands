import "server-only";

import Stripe from "stripe";
import { getStripeCheckoutConfig } from "./stripe-config";

export function getStripeCheckoutClient() {
  const config = getStripeCheckoutConfig();

  if (!config) {
    return null;
  }

  return {
    priceId: config.priceId,
    stripe: new Stripe(config.secretKey),
  };
}
