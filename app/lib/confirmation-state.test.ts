import test from "node:test";
import assert from "node:assert/strict";
import {
  createConfirmationStateCookieValue,
  getConfirmationCookieSecret,
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

test("returns null when no confirmation cookie is present or the browser-expired cookie is gone", () => {
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

test("returns null for malformed confirmation cookie payloads", () => {
  assert.equal(
    readConfirmationStateCookieValue("not-base64.signature", signingSecret),
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

test("reads confirmation cookie secret from dedicated environment variable", () => {
  const previousSecret = process.env.CONFIRMATION_COOKIE_SECRET;

  process.env.CONFIRMATION_COOKIE_SECRET = " dedicated-confirmation-secret ";

  try {
    assert.equal(
      getConfirmationCookieSecret(),
      "dedicated-confirmation-secret",
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.CONFIRMATION_COOKIE_SECRET;
    } else {
      process.env.CONFIRMATION_COOKIE_SECRET = previousSecret;
    }
  }
});

test("does not use SMTP_URL as a confirmation cookie secret fallback", () => {
  const previousSecret = process.env.CONFIRMATION_COOKIE_SECRET;
  const previousSmtpUrl = process.env.SMTP_URL;

  delete process.env.CONFIRMATION_COOKIE_SECRET;
  process.env.SMTP_URL = "smtp://smtp-secret-should-not-sign-cookies";

  try {
    assert.equal(getConfirmationCookieSecret(), null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.CONFIRMATION_COOKIE_SECRET;
    } else {
      process.env.CONFIRMATION_COOKIE_SECRET = previousSecret;
    }

    if (previousSmtpUrl === undefined) {
      delete process.env.SMTP_URL;
    } else {
      process.env.SMTP_URL = previousSmtpUrl;
    }
  }
});
