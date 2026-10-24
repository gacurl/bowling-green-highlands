import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseAccess } from "../../lib/server/database";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
  failDatabaseMutations,
} from "../../lib/test-support/postgres-test-database";
import {
  authorizeAdminPasswordSetup,
  getAdminPasswordSetupOutcome,
  setupAdminOwnerPassword,
  type AdminPasswordSetupOptions,
} from "./admin-password-setup";
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

const BOOTSTRAP_PASSWORD = "synthetic-bootstrap-password";
const OWNER_PASSWORD = "synthetic-first-owner-password";
const OTHER_PASSWORD = "synthetic-other-password";

async function createCredentialStorePath() {
  return createTestDatabase();
}

function createBootstrapOptions(
  database: DatabaseAccess,
): AdminPasswordSetupOptions {
  return {
    adminPassword: BOOTSTRAP_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    database,
  };
}

async function createBootstrapCookie(database: DatabaseAccess) {
  const authentication = await authenticateAdminPassword(
    BOOTSTRAP_PASSWORD,
    createBootstrapOptions(database),
  );

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic bootstrap credential did not authenticate");
  }
  assert.equal(authentication.session.kind, "bootstrap");

  return createAdminSessionCookieValue(authentication.session);
}

test("matching password initializes owner access and invalidates bootstrap sessions", async () => {
  const database = await createCredentialStorePath();
  const firstBootstrapCookie = await createBootstrapCookie(database);
  const anotherBootstrapCookie = await createBootstrapCookie(database);
  const options = createBootstrapOptions(database);
  const result = await setupAdminOwnerPassword(
    {
      confirmation: OWNER_PASSWORD,
      cookieValue: firstBootstrapCookie,
      newPassword: OWNER_PASSWORD,
    },
    options,
  );

  assert.equal(result, "initialized");
  assert.deepEqual(getAdminPasswordSetupOutcome(result), {
    clearSession: true,
    redirectPath: "/admin/login?setup=1",
  });

  const currentSession = await resolveAdminSessionCredential(options);
  assert.ok(currentSession);
  assert.equal(currentSession?.kind, "owner");
  assert.equal(
    await isValidAdminSessionCookieValue(
      anotherBootstrapCookie,
      currentSession,
    ),
    false,
  );
  assert.equal(
    await authorizeAdminPasswordSetup(firstBootstrapCookie, options),
    "invalid_session",
  );
  assert.equal(
    (await authenticateAdminPassword(OWNER_PASSWORD, options)).kind,
    "authenticated",
  );
  assert.equal(
    (await authenticateAdminPassword(BOOTSTRAP_PASSWORD, options)).kind,
    "invalid",
  );
});

test("setup rejects unauthenticated, owner, and recovery sessions", async () => {
  const database = await createCredentialStorePath();
  const bootstrapOptions = createBootstrapOptions(database);

  assert.equal(
    await authorizeAdminPasswordSetup(undefined, bootstrapOptions),
    "invalid_session",
  );

  await replaceAdminOwnerCredential(OWNER_PASSWORD, database);
  const ownerAuthentication = await authenticateAdminPassword(
    OWNER_PASSWORD,
    bootstrapOptions,
  );
  assert.equal(ownerAuthentication.kind, "authenticated");
  if (ownerAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic owner credential did not authenticate");
  }
  const ownerCookie = await createAdminSessionCookieValue(
    ownerAuthentication.session,
  );
  assert.equal(
    await authorizeAdminPasswordSetup(ownerCookie, bootstrapOptions),
    "invalid_session",
  );

  const recoveryOptions = {
    ...bootstrapOptions,
    recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
  };
  const recoveryAuthentication = await authenticateAdminPassword(
    BOOTSTRAP_PASSWORD,
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
    await authorizeAdminPasswordSetup(recoveryCookie, recoveryOptions),
    "invalid_session",
  );
});

test("disabling bootstrap mode makes an existing bootstrap session stale", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(database);

  assert.equal(
    await authorizeAdminPasswordSetup(cookieValue, {
      ...createBootstrapOptions(database),
      bootstrapMode: undefined,
    }),
    "invalid_session",
  );
});

test("mismatched and invalid passwords leave credential state missing", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(database);
  const options = createBootstrapOptions(database);

  assert.equal(
    await setupAdminOwnerPassword(
      {
        confirmation: OTHER_PASSWORD,
        cookieValue,
        newPassword: OWNER_PASSWORD,
      },
      options,
    ),
    "confirmation_mismatch",
  );
  assert.equal(
    await setupAdminOwnerPassword(
      {
        confirmation: "   ",
        cookieValue,
        newPassword: "   ",
      },
      options,
    ),
    "invalid_new_password",
  );
  assert.equal((await readAdminOwnerCredential(database)).kind, "missing");
});

test("persistence failure creates no partial owner credential", async () => {
  const database = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(database);
  const failingDatabase = failDatabaseMutations(database);

  assert.equal(
    await setupAdminOwnerPassword(
      {
        confirmation: OWNER_PASSWORD,
        cookieValue,
        newPassword: OWNER_PASSWORD,
      },
      createBootstrapOptions(failingDatabase),
    ),
    "persistence_failed",
  );
  assert.equal((await readAdminOwnerCredential(database)).kind, "missing");
});

test("unavailable credential state makes setup unavailable", async () => {
  assert.equal(
    await authorizeAdminPasswordSetup(
      "synthetic-bootstrap-cookie",
      createBootstrapOptions(createUnavailableTestDatabase()),
    ),
    "unavailable",
  );
});

test("setup redirects and errors never contain submitted passwords", () => {
  const outcomes = [
    getAdminPasswordSetupOutcome("initialized"),
    getAdminPasswordSetupOutcome("confirmation_mismatch"),
    getAdminPasswordSetupOutcome("invalid_new_password"),
    getAdminPasswordSetupOutcome("invalid_session"),
    getAdminPasswordSetupOutcome("persistence_failed"),
    getAdminPasswordSetupOutcome("unavailable"),
  ];

  for (const outcome of outcomes) {
    assert.doesNotMatch(outcome.redirectPath, /synthetic-(bootstrap|first)/);
  }
});
