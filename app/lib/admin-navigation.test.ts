import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowAdminNavigation } from "./admin-navigation";
import { createAdminSessionCookieValue } from "./admin-session";

test("hides admin navigation for public visitors", async () => {
  assert.equal(
    await shouldShowAdminNavigation(undefined, "farm-admin-password"),
    false,
  );
});

test("shows admin navigation for authenticated admins", async () => {
  const adminPassword = "farm-admin-password";
  const cookieValue = await createAdminSessionCookieValue(adminPassword);

  assert.equal(
    await shouldShowAdminNavigation(cookieValue, adminPassword),
    true,
  );
});
