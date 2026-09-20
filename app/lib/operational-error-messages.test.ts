import test from "node:test";
import assert from "node:assert/strict";
import {
  getAdminActionErrorMessage,
  getAdminLoginErrorMessage,
  getAdminLoginStatusMessage,
  getAdminPasswordChangeErrorMessage,
  getRequestStatusErrorMessage,
  getReserveErrorMessage,
} from "./operational-error-messages";

test("returns clear reservation failure messages without technical details", () => {
  assert.deepEqual(getReserveErrorMessage("validation"), {
    title: "The request could not be sent.",
    body: "Check your name, email, and selected time, then try again.",
  });
  assert.deepEqual(getReserveErrorMessage("persistence"), {
    title: "The request could not be saved.",
    body: "Please try again. If it still does not work, contact us directly.",
  });
  assert.deepEqual(getReserveErrorMessage("delivery"), {
    title: "The request was saved, but the email could not be sent.",
    body: "Please contact us directly so we can follow up on the saved request.",
  });
  assert.deepEqual(getReserveErrorMessage("configuration"), {
    title: "The request could not be sent.",
    body: "Your request was not saved. Please contact us directly so we can help.",
  });
});

test("returns safe admin login failure messages", () => {
  assert.equal(
    getAdminLoginErrorMessage("invalid_password"),
    "Password did not match. Try again.",
  );
  assert.equal(
    getAdminLoginErrorMessage("not_configured"),
    "Admin login is not ready. Ask the site operator to check setup.",
  );
  assert.equal(
    getAdminLoginErrorMessage("session_invalid"),
    "Your Admin session is no longer valid. Sign in again.",
  );
  assert.equal(
    getAdminLoginErrorMessage("credential_unavailable"),
    "Admin password access is unavailable. Ask the site operator to check setup.",
  );
  assert.equal(
    getAdminLoginStatusMessage("1"),
    "Password changed. Sign in again with your new password.",
  );
  assert.equal(getAdminLoginErrorMessage("other"), null);
  assert.equal(getAdminLoginStatusMessage(undefined), null);
});

test("returns safe Admin password-change messages", () => {
  assert.equal(
    getAdminPasswordChangeErrorMessage("incorrect_current_password"),
    "Current password did not match. No change was made.",
  );
  assert.equal(
    getAdminPasswordChangeErrorMessage("confirmation_mismatch"),
    "New password and confirmation must match. No change was made.",
  );
  assert.equal(
    getAdminPasswordChangeErrorMessage("invalid_new_password"),
    "Enter a new password that is not blank and has no spaces at the beginning or end.",
  );
  assert.equal(
    getAdminPasswordChangeErrorMessage("persistence_failed"),
    "Password could not be changed. Your current password still works. Try again.",
  );
  assert.equal(
    getAdminPasswordChangeErrorMessage("owner_mode_required"),
    "Password changes are available only after signing in with the owner password during normal operation.",
  );
  assert.equal(getAdminPasswordChangeErrorMessage("other"), null);
});

test("returns recoverable admin load and action messages", () => {
  assert.deepEqual(getAdminActionErrorMessage("availability_load"), {
    title: "Availability could not be loaded.",
    body: "Refresh the page before changing dates. If it repeats, check the saved availability records.",
  });
  assert.deepEqual(getAdminActionErrorMessage("requests_load"), {
    title: "Reservation requests could not be loaded.",
    body: "Refresh the page before reviewing requests. Availability controls are still shown if they loaded.",
  });
  assert.deepEqual(getAdminActionErrorMessage("request_not_found"), {
    title: "That request could not be found.",
    body: "Return to the request list and try again.",
  });
});

test("returns request status failure messages that state whether changes saved", () => {
  assert.deepEqual(getRequestStatusErrorMessage("action_failed"), {
    title: "The request status could not be saved.",
    body: "No status change was saved. Go back to admin, refresh, and try again.",
  });
  assert.deepEqual(getRequestStatusErrorMessage("invalid_transition"), {
    title: "This request status is already set.",
    body: "No status change was saved. Go back to admin to review the current request list.",
  });
  assert.deepEqual(getRequestStatusErrorMessage("slot_conflict"), {
    title: "Another request is already accepted for this slot.",
    body: "No status change was saved. Decline this request or review the accepted request first.",
  });
});
