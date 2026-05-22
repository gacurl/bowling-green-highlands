import test from "node:test";
import assert from "node:assert/strict";
import {
  createConfirmationStateCookieValue,
  readConfirmationStateCookieValue,
  type ConfirmationState,
} from "./confirmation-state";

const signingSecret = "test-signing-secret";

const confirmationState: ConfirmationState = {
  contactEmail: "operator@example.com",
  eventType: "farm_stay",
  guestEmail: "guest@example.com",
  guestName: "Guest Name",
  requestedDates: "2026-06-12 09:00 to 09:30",
  requestNotes: "Please call first.",
};

test("returns null when no confirmation cookie is present", () => {
  assert.equal(
    readConfirmationStateCookieValue(undefined, signingSecret),
    null,
  );
});

test("returns null for malformed confirmation cookie values", () => {
  assert.equal(
    readConfirmationStateCookieValue("submitted=1", signingSecret),
    null,
  );
});

test("returns null when required confirmation details are missing", () => {
  const cookieValue = createConfirmationStateCookieValue(
    {
      ...confirmationState,
      guestEmail: "",
    },
    signingSecret,
  );

  assert.equal(
    readConfirmationStateCookieValue(cookieValue, signingSecret),
    null,
  );
});

test("returns null when confirmation details are signed with a different secret", () => {
  const cookieValue = createConfirmationStateCookieValue(
    confirmationState,
    "other-signing-secret",
  );

  assert.equal(
    readConfirmationStateCookieValue(cookieValue, signingSecret),
    null,
  );
});

test("preserves server-created confirmation details", () => {
  const cookieValue = createConfirmationStateCookieValue(
    confirmationState,
    signingSecret,
  );

  assert.deepEqual(
    readConfirmationStateCookieValue(cookieValue, signingSecret),
    confirmationState,
  );
});
