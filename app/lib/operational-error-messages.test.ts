import test from "node:test";
import assert from "node:assert/strict";
import {
  getAdminActionErrorMessage,
  getAdminLoginErrorMessage,
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
  assert.equal(getAdminLoginErrorMessage("other"), null);
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
