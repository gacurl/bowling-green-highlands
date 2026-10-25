import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseAccess } from "../../lib/server/database";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
  failDatabaseMutations,
} from "../../lib/test-support/postgres-test-database";
import {
  changeAdminOwnerPassword,
  getAdminPasswordChangeOutcome,
} from "./admin-password-change";
import {
  ADMIN_RECOVERY_MODE_ENABLED_VALUE,
  authenticateAdminPassword,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "./admin-credential-store";
import {
  createAdminSessionCookieValue,
  isValidAdminSessionCookieValue,
} from "./admin-session";

const CURRENT_PASSWORD = "synthetic-current-owner-password";
const NEW_PASSWORD = "synthetic-new-owner-password";
const RECOVERY_PASSWORD = "synthetic-recovery-password";

async function createCredentialStorePath() {
  return createTestDatabase();
}

async function createOwnerSession(database: DatabaseAccess) {
  assert.equal(
    (await replaceAdminOwnerCredential(CURRENT_PASSWORD, database)).kind,
    "replaced",
  );

  const authentication = await authenticateAdminPassword(CURRENT_PASSWORD, {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    database,
  });

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic owner credential did not authenticate");
  }

  return createAdminSessionCookieValue(authentication.session);
}

function createChangeOptions(database: DatabaseAccess) {
  return {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    database,
  };
}

test("authenticated owner changes password and invalidates the prior session", async () => {
  const database = await createCredentialStorePath();
  const oldCookie = await createOwnerSession(database);
  const result = await changeAdminOwnerPassword(
    {
      confirmation: NEW_PASSWORD,
      cookieValue: oldCookie,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    },
    createChangeOptions(database),
  );

  assert.equal(result, "changed");
  assert.deepEqual(getAdminPasswordChangeOutcome(result), {
    clearSession: true,
    redirectPath: "/admin/login?changed=1",
  });
  assert.equal(
    (
      await authenticateAdminPassword(CURRENT_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "invalid",
  );
  assert.equal(
    (
      await authenticateAdminPassword(NEW_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "authenticated",
  );

  const currentSession = await resolveAdminSessionCredential(
    createChangeOptions(database),
  );
  assert.equal(
    await isValidAdminSessionCookieValue(oldCookie, currentSession),
    false,
  );
});

test("incorrect current password leaves the existing credential unchanged", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createOwnerSession(database);
  const result = await changeAdminOwnerPassword(
    {
      confirmation: NEW_PASSWORD,
      cookieValue,
      currentPassword: "synthetic-incorrect-current-password",
      newPassword: NEW_PASSWORD,
    },
    createChangeOptions(database),
  );

  assert.equal(result, "incorrect_current_password");
  assert.equal(
    (
      await authenticateAdminPassword(CURRENT_PASSWORD, {
        ...createChangeOptions(database),
      })
    ).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword(NEW_PASSWORD, {
        ...createChangeOptions(database),
      })
    ).kind,
    "invalid",
  );
});

test("mismatched or invalid replacement passwords do not change the credential", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createOwnerSession(database);
  const options = createChangeOptions(database);

  assert.equal(
    await changeAdminOwnerPassword(
      {
        confirmation: "synthetic-different-confirmation",
        cookieValue,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      options,
    ),
    "confirmation_mismatch",
  );
  assert.equal(
    await changeAdminOwnerPassword(
      {
        confirmation: "   ",
        cookieValue,
        currentPassword: CURRENT_PASSWORD,
        newPassword: "   ",
      },
      options,
    ),
    "invalid_new_password",
  );
  assert.equal(
    (
      await authenticateAdminPassword(CURRENT_PASSWORD, {
        ...options,
      })
    ).kind,
    "authenticated",
  );
});

test("persistence failure leaves the previous owner credential valid", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createOwnerSession(database);
  const failingDatabase = failDatabaseMutations(database);

  const result = await changeAdminOwnerPassword(
    {
      confirmation: NEW_PASSWORD,
      cookieValue,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    },
    createChangeOptions(failingDatabase),
  );

  assert.equal(result, "persistence_failed");
  assert.equal(
    (
      await authenticateAdminPassword(
        CURRENT_PASSWORD,
        createChangeOptions(database),
      )
    ).kind,
    "authenticated",
  );
});

test("recovery sessions cannot replace the normal owner credential", async () => {
  const database = await createCredentialStorePath();
  await createOwnerSession(database);
  const recoveryOptions = {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    database,
  };
  const recoveryAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    recoveryOptions,
  );

  assert.equal(recoveryAuthentication.kind, "authenticated");
  if (recoveryAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }

  const recoveryCookie = await createAdminSessionCookieValue(
    recoveryAuthentication.session,
  );
  assert.equal(
    await changeAdminOwnerPassword(
      {
        confirmation: NEW_PASSWORD,
        cookieValue: recoveryCookie,
        currentPassword: RECOVERY_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      recoveryOptions,
    ),
    "owner_mode_required",
  );
  assert.equal(
    (
      await authenticateAdminPassword(
        CURRENT_PASSWORD,
        createChangeOptions(database),
      )
    ).kind,
    "authenticated",
  );
});

test("unavailable state and redirects never expose submitted passwords", async () => {
  const database = createUnavailableTestDatabase();
  const result = await changeAdminOwnerPassword(
    {
      confirmation: NEW_PASSWORD,
      cookieValue: "synthetic-invalid-session-cookie",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    },
    createChangeOptions(database),
  );
  const outcomes = [
    getAdminPasswordChangeOutcome(result),
    getAdminPasswordChangeOutcome("incorrect_current_password"),
    getAdminPasswordChangeOutcome("confirmation_mismatch"),
    getAdminPasswordChangeOutcome("invalid_new_password"),
    getAdminPasswordChangeOutcome("persistence_failed"),
  ];

  assert.equal(result, "unavailable");
  for (const outcome of outcomes) {
    assert.doesNotMatch(outcome.redirectPath, /synthetic-(current|new)-owner/);
  }
});
