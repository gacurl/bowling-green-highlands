import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
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

async function createCredentialStorePath() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "bgh-admin-password-recovery-"),
  );

  return path.join(directory, "admin-owner-credential.json");
}

function createRecoveryOptions(
  storePath: string,
): AdminPasswordRecoveryOptions {
  return {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
    storePath,
  };
}

async function createRecoveryCookie(storePath: string) {
  const authentication = await authenticateAdminPassword(
    RECOVERY_PASSWORD,
    createRecoveryOptions(storePath),
  );

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic recovery credential did not authenticate");
  }
  assert.equal(authentication.session.kind, "recovery");

  return createAdminSessionCookieValue(authentication.session);
}

async function createOwnerCookie(storePath: string) {
  const authentication = await authenticateAdminPassword(OWNER_PASSWORD, {
    adminPassword: RECOVERY_PASSWORD,
    recoveryMode: undefined,
    storePath,
  });

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic owner credential did not authenticate");
  }

  return createAdminSessionCookieValue(authentication.session);
}

test("recovery reset denies unauthenticated, owner, and bootstrap sessions", async () => {
  const ownerStorePath = await createCredentialStorePath();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, ownerStorePath)).kind,
    "replaced",
  );
  const recoveryOptions = createRecoveryOptions(ownerStorePath);

  assert.equal(
    await authorizeAdminPasswordRecovery(undefined, recoveryOptions),
    "invalid_session",
  );

  const ownerCookie = await createOwnerCookie(ownerStorePath);
  assert.equal(
    await authorizeAdminPasswordRecovery(ownerCookie, recoveryOptions),
    "invalid_session",
  );

  const bootstrapStorePath = await createCredentialStorePath();
  const bootstrapOptions = {
    adminPassword: RECOVERY_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    storePath: bootstrapStorePath,
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
  const storePath = await createCredentialStorePath();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, storePath)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(storePath);

  assert.equal(
    await authorizeAdminPasswordRecovery(
      cookieValue,
      createRecoveryOptions(storePath),
    ),
    "authorized",
  );
  assert.equal(
    await authorizeAdminPasswordRecovery(cookieValue, {
      ...createRecoveryOptions(storePath),
      recoveryMode: undefined,
    }),
    "invalid_session",
  );
  assert.equal(
    await authorizeAdminPasswordRecovery(
      "synthetic-stale-session-cookie",
      createRecoveryOptions(storePath),
    ),
    "invalid_session",
  );
});

test("matching recovery reset rotates all sessions and requires normal sign-in", async () => {
  const storePath = await createCredentialStorePath();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, storePath)).kind,
    "replaced",
  );
  const ownerCookie = await createOwnerCookie(storePath);
  const currentRecoveryCookie = await createRecoveryCookie(storePath);
  const otherRecoveryCookie = await createRecoveryCookie(storePath);
  const recoveryOptions = createRecoveryOptions(storePath);

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
  const storePath = await createCredentialStorePath();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, storePath)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(storePath);
  const options = createRecoveryOptions(storePath);

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
  const storePath = await createCredentialStorePath();
  const recoveryOptions = createRecoveryOptions(storePath);
  const cookieValue = await createRecoveryCookie(storePath);

  assert.equal((await readAdminOwnerCredential(storePath)).kind, "missing");
  assert.equal(
    await authorizeAdminPasswordRecovery(cookieValue, {
      ...recoveryOptions,
      recoveryMode: undefined,
    }),
    "invalid_session",
  );
  assert.equal((await readAdminOwnerCredential(storePath)).kind, "missing");

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
  assert.equal((await readAdminOwnerCredential(storePath)).kind, "ready");
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

test("malformed and unreadable credential state cannot be overwritten", async () => {
  const malformedStorePath = await createCredentialStorePath();
  const malformedContents = "malformed synthetic credential state\n";
  await writeFile(malformedStorePath, malformedContents, "utf8");
  const unreadableStorePath = await createCredentialStorePath();
  await mkdir(unreadableStorePath);

  for (const storePath of [malformedStorePath, unreadableStorePath]) {
    assert.equal(
      await resetAdminOwnerPasswordFromRecovery(
        {
          confirmation: REPLACEMENT_PASSWORD,
          cookieValue: "synthetic-recovery-cookie",
          newPassword: REPLACEMENT_PASSWORD,
        },
        createRecoveryOptions(storePath),
      ),
      "unavailable",
    );
    assert.equal((await readAdminOwnerCredential(storePath)).kind, "unavailable");
  }

  assert.equal(
    await readFile(malformedStorePath, "utf8"),
    malformedContents,
  );
});

test("persistence failure preserves the existing owner credential", async () => {
  const storePath = await createCredentialStorePath();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, storePath)).kind,
    "replaced",
  );
  const cookieValue = await createRecoveryCookie(storePath);
  await mkdir(`${storePath}.tmp`);

  assert.equal(
    await resetAdminOwnerPasswordFromRecovery(
      {
        confirmation: REPLACEMENT_PASSWORD,
        cookieValue,
        newPassword: REPLACEMENT_PASSWORD,
      },
      createRecoveryOptions(storePath),
    ),
    "persistence_failed",
  );

  const normalOptions = {
    ...createRecoveryOptions(storePath),
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
