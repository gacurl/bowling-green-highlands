export const STRIPE_SECRET_KEY_ENV_NAME = "STRIPE_SECRET_KEY";
export const STRIPE_CHECKOUT_PRICE_ID_ENV_NAME = "STRIPE_CHECKOUT_PRICE_ID";
export const STRIPE_WEBHOOK_SECRET_ENV_NAME = "STRIPE_WEBHOOK_SECRET";

export type StripeCheckoutConfig = {
  priceId: string;
  secretKey: string;
};

export function getStripeCheckoutConfig(): StripeCheckoutConfig | null {
  const secretKey = process.env[STRIPE_SECRET_KEY_ENV_NAME]?.trim();
  const priceId = process.env[STRIPE_CHECKOUT_PRICE_ID_ENV_NAME]?.trim();

  if (!secretKey || !priceId) {
    return null;
  }

  return {
    priceId,
    secretKey,
  };
}

export function getStripeWebhookSecret(): string | null {
  return process.env[STRIPE_WEBHOOK_SECRET_ENV_NAME]?.trim() || null;
}
