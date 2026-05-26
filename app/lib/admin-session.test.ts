import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminSessionCookieValue,
  getAdminSessionCookieClearOptions,
  getAdminSessionCookieOptions,
  isAdminPasswordConfigured,
  isValidAdminSessionCookieValue,
} from "./admin-session";

test("identifies configured admin password", () => {
  assert.equal(isAdminPasswordConfigured(undefined), false);
  assert.equal(isAdminPasswordConfigured(""), false);
  assert.equal(isAdminPasswordConfigured("   "), false);
  assert.equal(isAdminPasswordConfigured("secret-pass"), true);
});

test("validates signed admin session cookie values", async () => {
  const adminPassword = "farm-admin-password";
  const cookieValue = await createAdminSessionCookieValue(adminPassword);

  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, adminPassword),
    true,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, "different-password"),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue("tampered-cookie-value", adminPassword),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(undefined, adminPassword),
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
