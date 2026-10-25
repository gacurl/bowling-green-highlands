import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseAccess } from "../../lib/server/database";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
  failDatabaseMutations,
} from "../../lib/test-support/postgres-test-database";
import {
  authorizeAdminPasswordRecovery,
  getAdminPasswordRecoveryOutcome,
  resetAdminOwnerPasswordFromRecovery,
  type AdminPasswordRecoveryOptions,
} from "./admin-password-recovery";
import {
  ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
  ADMIN_RECOVERY_MODE_ENABLED_VALUE,
  authenticateAdminPassword,
  readAdminOwnerCredential,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "./admin-credential-store";
import {
  createAdminSessionCookieValue,
  isValidAdminSessionCookieValue,
} from "./admin-session";

const OWNER_PASSWORD = "synthetic-current-owner-password";
const REPLACEMENT_PASSWORD = "synthetic-replacement-owner-password";
const RECOVERY_PASSWORD = "synthetic-recovery-password";

async function createCredentialDatabase() {
  return createTestDatabase();
}

function createRecoveryOptions(
  database: DatabaseAccess,
): AdminPasswordRecoveryOptions {
  return {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    database,
  };
}

async function createRecoveryCookie(database: DatabaseAccess) {
  const authentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    createRecoveryOptions(database),
  );

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }
  assert.equal(authentication.session.kind, "recovery");

  return createAdminSessionCookieValue(authentication.session);
}

async function createOwnerCookie(database: DatabaseAccess) {
  const authentication = await authenticateAdminPassword(OWNER_PASSWORD, {
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

test("recovery reset denies unauthenticated, owner, and bootstrap sessions", async () => {
  const ownerDatabase = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, ownerDatabase)).kind,
    "replaced",
  );
  const recoveryOptions = createRecoveryOptions(ownerDatabase);

  assert.equal(
    await authorizeAdminPasswordRecovery(undefined, recoveryOptions),
    "invalid_session",
  );

  const ownerCookie = await createOwnerCookie(ownerDatabase);
  assert.equal(
    await authorizeAdminPasswordRecovery(ownerCookie, recoveryOptions),
    "invalid_session",
  );

  const bootstrapDatabase = await createCredentialDatabase();
  const bootstrapOptions = {
    adminPassword: RECOVERY_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    database: bootstrapDatabase,
  };
  const bootstrapAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    bootstrapOptions,
  );
  assert.equal(bootstrapAuthentication.kind, "authenticated");
  if (bootstrapAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic bootstrap credential did not authenticate");
  }
  const bootstrapCookie = await createAdminSessionCookieValue(
    bootstrapAuthentication.session,
  );

  assert.equal(
    await authorizeAdminPasswordRecovery(bootstrapCookie, {
      ...bootstrapOptions,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    }),
    "invalid_session",
  );
});

test("recovery reset requires enabled recovery mode and a current recovery session", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(database);

  assert.equal(
    await authorizeAdminPasswordRecovery(
      cookieValue,
      createRecoveryOptions(database),
    ),
    "authorized",
  );
  assert.equal(
    await authorizeAdminPasswordRecovery(cookieValue, {
      ...createRecoveryOptions(database),
      recoveryMode: undefined,
    }),
    "invalid_session",
  );
  assert.equal(
    await authorizeAdminPasswordRecovery(
      "synthetic-stale-session-cookie",
      createRecoveryOptions(database),
    ),
    "invalid_session",
  );
});

test("matching recovery reset rotates all sessions and requires normal sign-in", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );
  const ownerCookie = await createOwnerCookie(database);
  const currentRecoveryCookie = await createRecoveryCookie(database);
  const otherRecoveryCookie = await createRecoveryCookie(database);
  const recoveryOptions = createRecoveryOptions(database);

  const result = await resetAdminOwnerPasswordFromRecovery(
    {
      confirmation: REPLACEMENT_PASSWORD,
      cookieValue: currentRecoveryCookie,
      newPassword: REPLACEMENT_PASSWORD,
    },
    recoveryOptions,
  );

  assert.equal(result, "reset");
  assert.deepEqual(getAdminPasswordRecoveryOutcome(result), {
    clearSession: true,
    redirectPath: "/admin/login?reset=1",
  });

  const postResetRecoverySession = await resolveAdminSessionCredential(
    recoveryOptions,
  );
  assert.equal(postResetRecoverySession?.kind, "recovery");
  assert.equal(
    await isValidAdminSessionCookieValue(
      currentRecoveryCookie,
      postResetRecoverySession,
    ),
    false,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(
      otherRecoveryCookie,
      postResetRecoverySession,
    ),
    false,
  );

  const normalOptions = {
    ...recoveryOptions,
    recoveryMode: undefined,
  };
  const postResetOwnerSession = await resolveAdminSessionCredential(
    normalOptions,
  );
  assert.equal(postResetOwnerSession?.kind, "owner");
  assert.equal(
    await isValidAdminSessionCookieValue(ownerCookie, postResetOwnerSession),
    false,
  );
  assert.equal(
    (
      await authenticateAdminPassword(REPLACEMENT_PASSWORD, normalOptions)
    ).kind,
    "authenticated",
  );
  assert.equal(
    (await authenticateAdminPassword(RECOVERY_PASSWORD, normalOptions)).kind,
    "invalid",
  );
});

test("mismatched, blank, and whitespace-padded passwords preserve the owner credential", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(database);
  const options = createRecoveryOptions(database);

  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: "synthetic-different-confirmation",
        cookieValue,
        newPassword: REPLACEMENT_PASSWORD,
      },
      options,
    ),
    "confirmation_mismatch",
  );
  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: "",
        cookieValue,
        newPassword: "",
      },
      options,
    ),
    "invalid_new_password",
  );
  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: ` ${REPLACEMENT_PASSWORD}`,
        cookieValue,
        newPassword: ` ${REPLACEMENT_PASSWORD}`,
      },
      options,
    ),
    "invalid_new_password",
  );
  assert.equal(
    (
      await authenticateAdminPassword(OWNER_PASSWORD, {
        ...options,
        recoveryMode: undefined,
      })
    ).kind,
    "authenticated",
  );
});

test("missing credential state can be restored only through explicit recovery mode", async () => {
  const database = await createCredentialDatabase();
  const recoveryOptions = createRecoveryOptions(database);
  const cookieValue = await createRecoveryCookie(database);

  assert.equal((await readAdminOwnerCredential(database)).kind, "missing");
  assert.equal(
    await authorizeAdminPasswordRecovery(cookieValue, {
      ...recoveryOptions,
      recoveryMode: undefined,
    }),
    "invalid_session",
  );
  assert.equal((await readAdminOwnerCredential(database)).kind, "missing");

  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: REPLACEMENT_PASSWORD,
        cookieValue,
        newPassword: REPLACEMENT_PASSWORD,
      },
      recoveryOptions,
    ),
    "reset",
  );
  assert.equal((await readAdminOwnerCredential(database)).kind, "ready");
  assert.equal(
    (
      await authenticateAdminPassword(REPLACEMENT_PASSWORD, {
        ...recoveryOptions,
        recoveryMode: undefined,
      })
    ).kind,
    "authenticated",
  );
});

test("unavailable credential state cannot be overwritten", async () => {
  const unavailableDatabase = createUnavailableTestDatabase();

  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: REPLACEMENT_PASSWORD,
        cookieValue: "synthetic-recovery-cookie",
        newPassword: REPLACEMENT_PASSWORD,
      },
      createRecoveryOptions(unavailableDatabase),
    ),
    "unavailable",
  );
  assert.equal(
    (await readAdminOwnerCredential(unavailableDatabase)).kind,
    "unavailable",
  );
});

test("persistence failure preserves the existing owner credential", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(database);
  const failingDatabase = failDatabaseMutations(database);

  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: REPLACEMENT_PASSWORD,
        cookieValue,
        newPassword: REPLACEMENT_PASSWORD,
      },
      createRecoveryOptions(failingDatabase),
    ),
    "persistence_failed",
  );

  const normalOptions = {
    ...createRecoveryOptions(database),
    recoveryMode: undefined,
  };
  assert.equal(
    (await authenticateAdminPassword(OWNER_PASSWORD, normalOptions)).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword(REPLACEMENT_PASSWORD, normalOptions)
    ).kind,
    "invalid",
  );
});

test("recovery outcomes never expose submitted passwords", () => {
  const outcomes = [
    getAdminPasswordRecoveryOutcome("reset"),
    getAdminPasswordRecoveryOutcome("confirmation_mismatch"),
    getAdminPasswordRecoveryOutcome("invalid_new_password"),
    getAdminPasswordRecoveryOutcome("invalid_session"),
    getAdminPasswordRecoveryOutcome("persistence_failed"),
    getAdminPasswordRecoveryOutcome("unavailable"),
  ];

  for (const outcome of outcomes) {
    assert.doesNotMatch(
      outcome.redirectPath,
      /synthetic-(current|replacement|recovery)/,
    );
  }
});
