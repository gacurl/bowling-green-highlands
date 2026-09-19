import test from "node:test";
import assert from "node:assert/strict";
import {
  getCanonicalPaymentPath,
  getCheckoutReturnState,
  getPaymentPageContent,
} from "./payment-page-content";

test("cancelled Checkout return remains payable without claiming completion", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("cancelled"),
    "unpaid",
  );

  assert.equal(pageContent.title, "Payment was not completed.");
  assert.equal(pageContent.description, "Your reservation request remains accepted.");
  assert.match(pageContent.notice ?? "", /try again/i);
  assert.equal(pageContent.primaryAction, "pay");
  assert.equal(pageContent.reservationStatusLabel, "Accepted");
  assert.equal(pageContent.paymentStatusLabel, "Not yet verified");
  assert.doesNotMatch(pageContent.notice ?? "", /verified|paid|success/i);
});

test("returned Checkout state does not claim trusted payment completion", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("returned"),
    "unpaid",
  );

  assert.equal(pageContent.title, "We’re verifying your payment.");
  assert.match(pageContent.notice ?? "", /does not verify or confirm payment/i);
  assert.match(pageContent.description, /does not confirm payment/i);
  assert.equal(pageContent.primaryAction, "refresh");
  assert.equal(pageContent.reservationStatusLabel, "Accepted");
  assert.equal(pageContent.paymentStatusLabel, "Not yet verified");
  assert.notEqual(
    pageContent.reservationStatusLabel,
    pageContent.paymentStatusLabel,
  );
  assert.doesNotMatch(pageContent.notice ?? "", /paid|success|complete/i);
});

test("unavailable Checkout state remains accepted and offers secure retry", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("unavailable"),
    "unpaid",
  );

  assert.equal(pageContent.title, "Payment could not be started.");
  assert.equal(pageContent.description, "Your reservation request remains accepted.");
  assert.equal(
    pageContent.notice,
    "No payment was made. Please try secure payment again.",
  );
  assert.equal(pageContent.primaryAction, "pay");
  assert.equal(pageContent.reservationStatusLabel, "Accepted");
  assert.equal(pageContent.paymentStatusLabel, "Not yet verified");
});

test("returned-state refresh targets the canonical payment URL", () => {
  const pageContent = getPaymentPageContent(
    true,
    getCheckoutReturnState("returned"),
    "unpaid",
  );

  assert.equal(pageContent.primaryAction, "refresh");
  assert.equal(getCanonicalPaymentPath("request id"), "/pay/request%20id");
});

test("canonical unpaid state exposes secure payment", () => {
  const pageContent = getPaymentPageContent(
    true,
    null,
    "unpaid",
  );

  assert.equal(pageContent.title, "Complete your payment.");
  assert.equal(pageContent.notice, null);
  assert.equal(pageContent.primaryAction, "pay");
  assert.equal(pageContent.paymentStatusLabel, "Not yet verified");
});

test("persisted paid status shows success without another payment action", () => {
  const pageContent = getPaymentPageContent(true, null, "paid");

  assert.deepEqual(pageContent, {
    description: "Your payment has been verified.",
    notice:
      "No further payment action is needed. Bowling Green Highlands will contact you with any next steps.",
    paymentStatusLabel: "Paid",
    primaryAction: null,
    reservationStatusLabel: "Accepted",
    title: "Payment received.",
  });
  assert.doesNotMatch(pageContent.description, /reservation confirmed/i);
});

test("persisted paid status overrides returned, cancelled, and unavailable states", () => {
  for (const returnState of ["returned", "cancelled", "unavailable"] as const) {
    const pageContent = getPaymentPageContent(
      true,
      getCheckoutReturnState(returnState),
      "paid",
    );

    assert.equal(pageContent.title, "Payment received.");
    assert.equal(pageContent.paymentStatusLabel, "Paid");
    assert.equal(pageContent.primaryAction, null);
  }
});
