import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminRedirectPath,
  isProtectedAdminPath,
  shouldRedirectToAdminLogin,
} from "./admin-guard";
import {
  createAdminSessionCookieValue,
  type AdminSessionCredential,
} from "./admin-session";

const ownerSession: AdminSessionCredential = {
  kind: "owner",
  sessionVersion: "synthetic-session-version",
  signingKey: "synthetic-session-signing-key",
};

test("protects admin paths and excludes login endpoints", () => {
  assert.equal(isProtectedAdminPath("/"), false);
  assert.equal(isProtectedAdminPath("/reserve"), false);
  assert.equal(isProtectedAdminPath("/admin"), true);
  assert.equal(isProtectedAdminPath("/admin/content"), true);
  assert.equal(isProtectedAdminPath("/admin/login"), false);
  assert.equal(isProtectedAdminPath("/admin/login/submit"), false);
});

test("builds login redirect path with original admin path", () => {
  assert.equal(
    getAdminRedirectPath("/admin/content", "?saved=1"),
    "/admin/login?next=%2Fadmin%2Fcontent%3Fsaved%3D1",
  );
});

test("redirects when request has no valid admin session", async () => {
  assert.equal(
    await shouldRedirectToAdminLogin(
      "/admin/content",
      "",
      undefined,
      ownerSession,
    ),
    "/admin/login?next=%2Fadmin%2Fcontent",
  );
});

test("does not redirect when request has a valid admin session", async () => {
  const cookieValue = await createAdminSessionCookieValue(ownerSession);

  assert.equal(
    await shouldRedirectToAdminLogin(
      "/admin/content",
      "",
      cookieValue,
      ownerSession,
    ),
    null,
  );
});
