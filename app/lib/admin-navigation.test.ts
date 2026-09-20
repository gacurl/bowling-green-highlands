import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowAdminNavigation } from "./admin-navigation";
import {
  createAdminSessionCookieValue,
  type AdminSessionCredential,
} from "./admin-session";

const ownerSession: AdminSessionCredential = {
  kind: "owner",
  sessionVersion: "synthetic-session-version",
  signingKey: "synthetic-session-signing-key",
};

test("hides admin navigation for public visitors", async () => {
  assert.equal(await shouldShowAdminNavigation(undefined, ownerSession), false);
});

test("shows admin navigation for authenticated admins", async () => {
  const cookieValue = await createAdminSessionCookieValue(ownerSession);

  assert.equal(await shouldShowAdminNavigation(cookieValue, ownerSession), true);
});
