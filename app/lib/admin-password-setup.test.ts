import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
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
  const directory = await mkdtemp(
    path.join(tmpdir(), "bgh-admin-password-setup-"),
  );

  return path.join(directory, "admin-owner-credential.json");
}

function createBootstrapOptions(storePath: string): AdminPasswordSetupOptions {
  return {
    adminPassword: BOOTSTRAP_PASSWORD,
    bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
    recoveryMode: undefined,
    storePath,
  };
}

async function createBootstrapCookie(storePath: string) {
  const authentication = await authenticateAdminPassword(
    BOOTSTRAP_PASSWORD,
    createBootstrapOptions(storePath),
  );

  assert.equal(authentication.kind, "authenticated");
  if (authentication.kind !== "authenticated") {
    assert.fail("Synthetic bootstrap credential did not authenticate");
  }
  assert.equal(authentication.session.kind, "bootstrap");

  return createAdminSessionCookieValue(authentication.session);
}

test("matching password initializes owner access and invalidates bootstrap sessions", async () => {
  const storePath = await createCredentialStorePath();
  const firstBootstrapCookie = await createBootstrapCookie(storePath);
  const anotherBootstrapCookie = await createBootstrapCookie(storePath);
  const options = createBootstrapOptions(storePath);
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
  const storePath = await createCredentialStorePath();
  const bootstrapOptions = createBootstrapOptions(storePath);

  assert.equal(
    await authorizeAdminPasswordSetup(undefined, bootstrapOptions),
    "invalid_session",
  );

  await replaceAdminOwnerCredential(OWNER_PASSWORD, storePath);
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
  const storePath = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(storePath);

  assert.equal(
    await authorizeAdminPasswordSetup(cookieValue, {
      ...createBootstrapOptions(storePath),
      bootstrapMode: undefined,
    }),
    "invalid_session",
  );
});

test("mismatched and invalid passwords leave credential state missing", async () => {
  const storePath = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(storePath);
  const options = createBootstrapOptions(storePath);

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
  assert.equal((await readAdminOwnerCredential(storePath)).kind, "missing");
});

test("persistence failure creates no partial owner credential", async () => {
  const storePath = await createCredentialStorePath();
  const cookieValue = await createBootstrapCookie(storePath);
  await mkdir(`${storePath}.tmp`);

  assert.equal(
    await setupAdminOwnerPassword(
      {
        confirmation: OWNER_PASSWORD,
        cookieValue,
        newPassword: OWNER_PASSWORD,
      },
      createBootstrapOptions(storePath),
    ),
    "persistence_failed",
  );
  assert.equal((await readAdminOwnerCredential(storePath)).kind, "missing");
});

test("malformed and unreadable state make setup unavailable", async () => {
  const malformedStorePath = await createCredentialStorePath();
  await writeFile(malformedStorePath, "malformed credential state\n", "utf8");
  const unreadableStorePath = await createCredentialStorePath();
  await mkdir(unreadableStorePath);

  for (const storePath of [malformedStorePath, unreadableStorePath]) {
    assert.equal(
      await authorizeAdminPasswordSetup(
        "synthetic-bootstrap-cookie",
        createBootstrapOptions(storePath),
      ),
      "unavailable",
    );
  }
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
