import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutRedirectResponse } from "./route";

test("created Checkout Session redirects to the exact hosted URL with 303", async () => {
  const checkoutUrl = "https://checkout.stripe.test/session";
  const response = createCheckoutRedirectResponse(
    "https://example.com/pay/accepted-id/checkout",
    "accepted-id",
    {
      kind: "created",
      url: checkoutUrl,
    },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), checkoutUrl);
  assert.equal(await response.text(), "");
});

test("unavailable Checkout redirects to the absolute recovery URL with 303", async () => {
  const response = createCheckoutRedirectResponse(
    "https://example.com/pay/accepted-id/checkout",
    "accepted-id",
    {
      kind: "unavailable",
      reason: "checkout_failed",
    },
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/pay/accepted-id?checkout=unavailable",
  );
  assert.equal(await response.text(), "");
});
