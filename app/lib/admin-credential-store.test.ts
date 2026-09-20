import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
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
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-admin-credential-"));

  return path.join(directory, "admin-owner-credential.json");
}

test("stores a salted scrypt credential without the plaintext password", async () => {
  const storePath = await createCredentialStorePath();
  const replacement = await replaceAdminOwnerCredential(
    FIRST_OWNER_PASSWORD,
    storePath,
  );
  const serializedCredential = await readFile(storePath, "utf8");
  const storedCredential = JSON.parse(serializedCredential) as {
    algorithm?: unknown;
    hash?: unknown;
    parameters?: unknown;
    salt?: unknown;
  };

  assert.equal(replacement.kind, "replaced");
  assert.doesNotMatch(serializedCredential, new RegExp(FIRST_OWNER_PASSWORD));
  assert.equal(storedCredential.algorithm, "scrypt");
  assert.equal(typeof storedCredential.hash, "string");
  assert.equal(typeof storedCredential.salt, "string");
  assert.equal(typeof storedCredential.parameters, "object");

  assert.equal(
    (
      await authenticateAdminPassword(FIRST_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        storePath,
      })
    ).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword("synthetic-incorrect-password", {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        storePath,
      })
    ).kind,
    "invalid",
  );
});

test("replacement rotates salt and session version and invalidates old access", async () => {
  const storePath = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, storePath);

  const firstState = await readAdminOwnerCredential(storePath);
  const firstAuthentication = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      storePath,
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
    storePath,
  );
  const secondState = await readAdminOwnerCredential(storePath);

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
        storePath,
      })
    ).kind,
    "invalid",
  );

  const newAuthentication = await authenticateAdminPassword(
    SECOND_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      storePath,
    },
  );
  const currentSession = await resolveAdminSessionCredential({
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    storePath,
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
  const storePath = await createCredentialStorePath();
  const disabledAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      storePath,
    },
  );
  const bootstrapAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
      storePath,
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
        storePath,
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
        storePath,
      })
    ).kind,
    "unavailable",
  );
  assert.equal(
    await resolveAdminSessionCredential({
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: undefined,
      storePath,
    }),
    null,
  );

  const recoveryAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      storePath,
    },
  );
  assert.equal(recoveryAuthentication.kind, "authenticated");
  if (recoveryAuthentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }
  assert.equal(recoveryAuthentication.session.kind, "recovery");
});

test("initialized state separates owner authentication from explicit recovery", async () => {
  const storePath = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, storePath);

  const ownerAuthentication = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      recoveryMode: undefined,
      storePath,
    },
  );
  const recoveryAsNormal = await authenticateAdminPassword(RECOVERY_PASSWORD, {
    adminPassword: RECOVERY_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    storePath,
  });
  const recoveryAuthentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      storePath,
    },
  );
  const ownerDuringRecovery = await authenticateAdminPassword(
    FIRST_OWNER_PASSWORD,
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      storePath,
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
    storePath,
  });
  const disabledRecoverySession = await resolveAdminSessionCredential({
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    storePath,
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
  const storePath = await createCredentialStorePath();
  const malformedCredential = "{\"schemaVersion\":1,\"algorithm\":\"unknown\"}\n";
  await writeFile(storePath, malformedCredential, "utf8");

  assert.equal((await readAdminOwnerCredential(storePath)).kind, "unavailable");
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
          storePath,
        })
      ).kind,
      "unavailable",
    );
  }
  assert.equal(
    (await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, storePath)).kind,
    "unavailable",
  );
  assert.equal(await readFile(storePath, "utf8"), malformedCredential);

  const unreadableStorePath = await createCredentialStorePath();
  await mkdir(unreadableStorePath);

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
          storePath: unreadableStorePath,
        })
      ).kind,
      "unavailable",
    );
  }
});

test("failed atomic replacement preserves the existing valid credential", async () => {
  const storePath = await createCredentialStorePath();
  await replaceAdminOwnerCredential(FIRST_OWNER_PASSWORD, storePath);
  const originalCredential = await readFile(storePath, "utf8");
  await mkdir(`${storePath}.tmp`);

  assert.equal(
    (await replaceAdminOwnerCredential(SECOND_OWNER_PASSWORD, storePath)).kind,
    "persistence_failed",
  );
  assert.equal(await readFile(storePath, "utf8"), originalCredential);
  assert.equal(
    (
      await authenticateAdminPassword(FIRST_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        storePath,
      })
    ).kind,
    "authenticated",
  );
  assert.equal(
    (
      await authenticateAdminPassword(SECOND_OWNER_PASSWORD, {
        adminPassword: RECOVERY_PASSWORD,
        recoveryMode: undefined,
        storePath,
      })
    ).kind,
    "invalid",
  );
});
