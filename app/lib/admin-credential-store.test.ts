import assert from "node:assert/strict";
import test from "node:test";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
  failDatabaseMutations,
} from "../../lib/test-support/postgres-test-database";
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

const FIRST_OWNER_PASSWORD = "synthetic-owner-password-one";
const SECOND_OWNER_PASSWORD = "synthetic-owner-password-two";
const RECOVERY_PASSWORD = "synthetic-break-glass-password";

async function createCredentialStorePath() {
  return createTestDatabase();
}

test("stores a salted scrypt credential without the plaintext password", async () => {
  const database = await createCredentialStorePath();
  const replacement = await replaceAdminOwnerCredential(
    FIRST_OWNER_PASSWORD,
    database,
  );
  const storedCredential = (
    await database.query<{
      algorithm: string;
      password_hash: string;
      salt: string;
      scrypt_cost: number;
    }>(`
      SELECT algorithm, password_hash, salt, scrypt_cost
      FROM admin_owner_credentials
    `)
  ).rows[0];
  const serializedCredential = JSON.stringify(storedCredential);

  assert.equal(replacement.kind, "replaced");
  assert.doesNotMatch(serializedCredential, new RegExp(FIRST_OWNER_PASSWORD));
  assert.equal(storedCredential.algorithm, "scrypt");
  assert.equal(typeof storedCredential.password_hash, "string");
  assert.equal(typeof storedCredential.salt, "string");
  assert.equal(storedCredential.scrypt_cost, 32768);

  assert.equal(
    (
      await authenticateAdminPassword(FIRST_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword("synthetic-incorrect-password", {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "invalid",
  );
});

test("replacement rotates salt and session version and invalidates old access", async () => {
  const database = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, database);

  const firstState = await readAdminOwnerCredential(database);
  const firstAuthentication = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      database,
    },
  );

  assert.equal(firstState.kind, "ready");
  assert.equal(firstAuthentication.kind, "authenticated");

  if (
    firstState.kind !== "ready" ||
    firstAuthentication.kind !== "authenticated"
  ) {
    assert.fail("Synthetic first credential was not available");
  }

  const oldCookie = await createAdminSessionCookieValue(
    firstAuthentication.session,
  );
  const replacement = await replaceAdminOwnerCredential(
    SECOND_OWNER_PASSWORD,
    database,
  );
  const secondState = await readAdminOwnerCredential(database);

  assert.equal(replacement.kind, "replaced");
  assert.equal(secondState.kind, "ready");

  if (secondState.kind !== "ready") {
    assert.fail("Synthetic replacement credential was not available");
  }

  assert.notEqual(secondState.credential.salt, firstState.credential.salt);
  assert.notEqual(
    secondState.credential.session.version,
    firstState.credential.session.version,
  );
  assert.equal(
    (
      await authenticateAdminPassword(FIRST_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "invalid",
  );

  const newAuthentication = await authenticateAdminPassword(
    SECOND_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      database,
    },
  );
  const currentSession = await resolveAdminSessionCredential({
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    database,
  });

  assert.equal(newAuthentication.kind, "authenticated");
  assert.ok(currentSession);
  assert.equal(
    await isValidAdminSessionCookieValue(oldCookie, currentSession),
    false,
  );

  if (newAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic replacement password did not authenticate");
  }

  const newCookie = await createAdminSessionCookieValue(
    newAuthentication.session,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(newCookie, currentSession),
    true,
  );
});

test("missing credential state requires explicit bootstrap mode", async () => {
  const database = await createCredentialStorePath();
  const disabledAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      database,
    },
  );
  const bootstrapAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
      database,
    },
  );

  assert.equal(disabledAuthentication.kind, "unavailable");
  assert.equal(bootstrapAuthentication.kind, "authenticated");
  if (bootstrapAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic bootstrap password did not authenticate");
  }
  assert.equal(bootstrapAuthentication.session.kind, "bootstrap");
  assert.equal(
    (
      await authenticateAdminPassword("synthetic-incorrect-password", {
        adminPassword: RECOVERY_PASSWORD,
        bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "invalid",
  );
  assert.equal(
    (
      await authenticateAdminPassword(RECOVERY_PASSWORD, {
        adminPassword: "   ",
        bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "unavailable",
  );
  assert.equal(
    await resolveAdminSessionCredential({
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      database,
    }),
    null,
  );

  const recoveryAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      database,
    },
  );
  assert.equal(recoveryAuthentication.kind, "authenticated");
  if (recoveryAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }
  assert.equal(recoveryAuthentication.session.kind, "recovery");
});

test("initialized state separates owner authentication from explicit recovery", async () => {
  const database = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, database);

  const ownerAuthentication = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
      database,
    },
  );
  const recoveryAsNormal = await authenticateAdminPassword(RECOVERY_PASSWORD, {
    adminPassword: RECOVERY_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    database,
  });
  const recoveryAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      database,
    },
  );
  const ownerDuringRecovery = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      database,
    },
  );

  assert.equal(ownerAuthentication.kind, "authenticated");
  assert.equal(recoveryAsNormal.kind, "invalid");
  assert.equal(recoveryAuthentication.kind, "authenticated");
  assert.equal(ownerDuringRecovery.kind, "invalid");

  if (recoveryAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }
  assert.equal(recoveryAuthentication.session.kind, "recovery");

  const recoveryCookie = await createAdminSessionCookieValue(
    recoveryAuthentication.session,
  );
  const recoverySession = await resolveAdminSessionCredential({
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    database,
  });
  const disabledRecoverySession = await resolveAdminSessionCredential({
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    database,
  });

  assert.equal(
    await isValidAdminSessionCookieValue(recoveryCookie, recoverySession),
    true,
  );
  assert.equal(
    await isValidAdminSessionCookieValue(
      recoveryCookie,
      disabledRecoverySession,
    ),
    false,
  );
});

test("malformed and unreadable credential state always fail closed", async () => {
  const database = await createCredentialStorePath();
  await database.query(`
    INSERT INTO admin_owner_credentials (
      singleton,
      schema_version,
      algorithm,
      password_hash,
      salt,
      scrypt_cost,
      scrypt_block_size,
      scrypt_parallelization,
      scrypt_key_length,
      session_signing_key,
      session_version
    )
    VALUES (
      TRUE,
      1,
      'scrypt',
      'invalid-hash',
      'invalid-salt',
      32768,
      8,
      3,
      64,
      'invalid-signing-key',
      '00000000-0000-4000-8000-000000000000'
    )
  `);

  assert.equal((await readAdminOwnerCredential(database)).kind, "unavailable");
  for (const modes of [
    { bootstrapMode: undefined, recoveryMode: undefined },
    {
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
    },
    {
      bootstrapMode: undefined,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    },
  ]) {
    assert.equal(
      (
        await authenticateAdminPassword(RECOVERY_PASSWORD, {
          adminPassword: RECOVERY_PASSWORD,
          ...modes,
          database,
        })
      ).kind,
      "unavailable",
    );
  }
  assert.equal(
    (await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, database)).kind,
    "unavailable",
  );
  assert.equal(
    (
      await database.query<{ password_hash: string }>(
        "SELECT password_hash FROM admin_owner_credentials",
      )
    ).rows[0].password_hash,
    "invalid-hash",
  );

  const unavailableDatabase = createUnavailableTestDatabase();

  for (const modes of [
    { bootstrapMode: undefined, recoveryMode: undefined },
    {
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
    },
    {
      bootstrapMode: undefined,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    },
  ]) {
    assert.equal(
      (
        await authenticateAdminPassword(RECOVERY_PASSWORD, {
          adminPassword: RECOVERY_PASSWORD,
          ...modes,
          database: unavailableDatabase,
        })
      ).kind,
      "unavailable",
    );
  }
});

test("failed atomic replacement preserves the existing valid credential", async () => {
  const database = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, database);
  const originalCredential = await readAdminOwnerCredential(database);
  const failingDatabase = failDatabaseMutations(database);

  assert.equal(
    (await replaceAdminOwnerCredential(SECOND_OWNER_PASSWORD, failingDatabase)).kind,
    "persistence_failed",
  );
  assert.deepEqual(await readAdminOwnerCredential(database), originalCredential);
  assert.equal(
    (
      await authenticateAdminPassword(FIRST_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword(SECOND_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        database,
      })
    ).kind,
    "invalid",
  );
});
