import test from "node:test";
import assert from "node:assert/strict";
import {
  getCheckoutReturnState,
  getPaymentPageContent,
} from "./payment-page-content";

test("cancelled Checkout return remains payable without claiming completion", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("cancelled"),
  );

  assert.equal(pageContent.title, "Payment was not completed.");
  assert.match(pageContent.notice ?? "", /try again/i);
  assert.doesNotMatch(pageContent.notice ?? "", /verified|paid|success/i);
});

test("returned Checkout state does not claim trusted payment completion", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("returned"),
  );

  assert.equal(pageContent.title, "You returned from Stripe.");
  assert.match(pageContent.notice ?? "", /does not verify or confirm payment/i);
  assert.match(pageContent.description, /verify payment separately/i);
  assert.doesNotMatch(pageContent.notice ?? "", /paid|success|complete/i);
});

test("unknown Checkout return state uses the normal payable state", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("anything-else"),
  );

  assert.equal(pageContent.title, "Complete your payment.");
  assert.equal(pageContent.notice, null);
});
