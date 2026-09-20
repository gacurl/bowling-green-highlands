import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminSessionCookieValue,
  getAdminLoginSuccessPath,
  getAdminSessionCookieClearOptions,
  getAdminSessionCookieOptions,
  isAdminPasswordConfigured,
  isValidAdminSessionCookieValue,
  type AdminSessionCredential,
} from "./admin-session";

const ownerSession: AdminSessionCredential = {
  kind: "owner",
  sessionVersion: "synthetic-session-version-one",
  signingKey: "synthetic-session-signing-key-one",
};

test("identifies configured admin password", () => {
  assert.equal(isAdminPasswordConfigured(undefined), false);
  assert.equal(isAdminPasswordConfigured(""), false);
  assert.equal(isAdminPasswordConfigured("   "), false);
  assert.equal(isAdminPasswordConfigured("secret-pass"), true);
});

test("bootstrap login goes directly to first-time password setup", () => {
  assert.equal(
    getAdminLoginSuccessPath("bootstrap", "/admin"),
    "/admin/password/setup",
  );
  assert.equal(getAdminLoginSuccessPath("owner", "/admin"), "/admin");
  assert.equal(getAdminLoginSuccessPath("recovery", "/admin"), "/admin");
});

test("validates signed admin session cookie values", async () => {
  const cookieValue = await createAdminSessionCookieValue(ownerSession);

  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, ownerSession),
    true,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, {
      ...ownerSession,
      sessionVersion: "synthetic-session-version-two",
    }),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue("tampered-cookie-value", ownerSession),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(undefined, ownerSession),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, null),
    false,
  );
});

test("returns secure cookie options for admin session and logout", () => {
  assert.deepEqual(getAdminSessionCookieOptions("production"), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 604800,
  });

  assert.deepEqual(getAdminSessionCookieClearOptions("production"), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
});
