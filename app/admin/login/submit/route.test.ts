import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import {
  setDatabaseForTests,
  type DatabaseAccess,
} from "../../../../lib/server/database";
import { createTestDatabase } from "../../../../lib/test-support/postgres-test-database";
import {
  ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
  ADMIN_RECOVERY_MODE_ENABLED_VALUE,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "../../../lib/admin-credential-store";
import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionCookieValue,
} from "../../../lib/admin-session";

type PostHandler = (typeof import("./route"))["POST"];

let postHandlerPromise: Promise<PostHandler> | undefined;

function getPostHandler() {
  if (!postHandlerPromise) {
    const moduleLoader = Module as typeof Module & {
      _load: (
        request: string,
        parent: unknown,
        isMain: boolean,
      ) => unknown;
    };
    const originalLoad = moduleLoader._load;

    moduleLoader._load = (request, parent, isMain) =>
      request === "server-only"
        ? {}
        : originalLoad.call(moduleLoader, request, parent, isMain);
    postHandlerPromise = import("./route")
      .then(({ POST }) => POST)
      .finally(() => {
        moduleLoader._load = originalLoad;
      });
  }

  return postHandlerPromise;
}

const OWNER_PASSWORD = "synthetic-owner-login-password";
const BOOTSTRAP_PASSWORD = "synthetic-bootstrap-login-password";
const RECOVERY_PASSWORD = "synthetic-recovery-login-password";
const INVALID_PASSWORD = "synthetic-invalid-login-password";

type LoginEnvironment = {
  adminPassword?: string;
  bootstrapMode?: string;
  database: DatabaseAccess;
  recoveryMode?: string;
};

async function createCredentialDatabase() {
  return createTestDatabase();
}

function createLoginRequest(password: string, next = "/admin") {
  return new Request("http://localhost/admin/login/submit", {
    body: new URLSearchParams({ next, password }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

function withLoginEnvironment(
  environment: LoginEnvironment,
  runTest: () => Promise<void>,
) {
  return async () => {
    const previousAdminPassword = process.env.ADMIN_PASSWORD;
    const previousBootstrapMode = process.env.BGH_ADMIN_BOOTSTRAP_MODE;
    const previousRecoveryMode = process.env.BGH_ADMIN_RECOVERY_MODE;

    if (environment.adminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = environment.adminPassword;
    }

    if (environment.bootstrapMode === undefined) {
      delete process.env.BGH_ADMIN_BOOTSTRAP_MODE;
    } else {
      process.env.BGH_ADMIN_BOOTSTRAP_MODE = environment.bootstrapMode;
    }

    if (environment.recoveryMode === undefined) {
      delete process.env.BGH_ADMIN_RECOVERY_MODE;
    } else {
      process.env.BGH_ADMIN_RECOVERY_MODE = environment.recoveryMode;
    }

    setDatabaseForTests(environment.database);

    try {
      await runTest();
    } finally {
      if (previousAdminPassword === undefined) {
        delete process.env.ADMIN_PASSWORD;
      } else {
        process.env.ADMIN_PASSWORD = previousAdminPassword;
      }

      if (previousBootstrapMode === undefined) {
        delete process.env.BGH_ADMIN_BOOTSTRAP_MODE;
      } else {
        process.env.BGH_ADMIN_BOOTSTRAP_MODE = previousBootstrapMode;
      }

      if (previousRecoveryMode === undefined) {
        delete process.env.BGH_ADMIN_RECOVERY_MODE;
      } else {
        process.env.BGH_ADMIN_RECOVERY_MODE = previousRecoveryMode;
      }

      setDatabaseForTests(null);
    }
  };
}

function assertPasswordNotExposed(response: Response, password: string) {
  const location = response.headers.get("location");
  assert.ok(location);
  assert.equal(location.includes(password), false);
  assert.equal(location.includes(encodeURIComponent(password)), false);
}

async function assertValidSessionCookie(
  response: Awaited<ReturnType<PostHandler>>,
) {
  const cookieValue = response.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const credential = await resolveAdminSessionCredential({
    adminPassword: process.env.ADMIN_PASSWORD,
    bootstrapMode: process.env.BGH_ADMIN_BOOTSTRAP_MODE,
    recoveryMode: process.env.BGH_ADMIN_RECOVERY_MODE,
  });

  assert.ok(cookieValue);
  assert.ok(credential);
  assert.equal(
    await isValidAdminSessionCookieValue(cookieValue, credential),
    true,
  );
}

test("successful owner login redirects with 303 and preserves the requested destination", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );

  await withLoginEnvironment(
    { database },
    async () => {
      const post = await getPostHandler();
      const response = await post(
        createLoginRequest(
          OWNER_PASSWORD,
          "/admin/requests/synthetic-request?view=detail",
        ),
      );

      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost/admin/requests/synthetic-request?view=detail",
      );
      assertPasswordNotExposed(response, OWNER_PASSWORD);
      await assertValidSessionCookie(response);
    },
  )();
});

test("successful bootstrap login redirects with 303 to password setup", async () => {
  const database = await createCredentialDatabase();

  await withLoginEnvironment(
    {
      adminPassword: BOOTSTRAP_PASSWORD,
      bootstrapMode: ADMIN_BOOTSTRAP_MODE_ENABLED_VALUE,
      database,
    },
    async () => {
      const post = await getPostHandler();
      const response = await post(createLoginRequest(BOOTSTRAP_PASSWORD));

      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost/admin/password/setup",
      );
      assertPasswordNotExposed(response, BOOTSTRAP_PASSWORD);
      await assertValidSessionCookie(response);
    },
  )();
});

test("successful recovery login redirects with 303 to password recovery", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );

  await withLoginEnvironment(
    {
      adminPassword: RECOVERY_PASSWORD,
      recoveryMode: ADMIN_RECOVERY_MODE_ENABLED_VALUE,
      database,
    },
    async () => {
      const post = await getPostHandler();
      const response = await post(createLoginRequest(RECOVERY_PASSWORD));

      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost/admin/password/recovery",
      );
      assertPasswordNotExposed(response, RECOVERY_PASSWORD);
      await assertValidSessionCookie(response);
    },
  )();
});

test("invalid password redirects with 303 and preserves the safe next parameter", async () => {
  const database = await createCredentialDatabase();
  assert.equal(
    (await replaceAdminOwnerCredential(OWNER_PASSWORD, database)).kind,
    "replaced",
  );

  await withLoginEnvironment(
    { database },
    async () => {
      const post = await getPostHandler();
      const response = await post(
        createLoginRequest(INVALID_PASSWORD, "/admin/requests/synthetic-request"),
      );

      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost/admin/login?error=invalid_password&next=%2Fadmin%2Frequests%2Fsynthetic-request",
      );
      assert.equal(response.cookies.get(ADMIN_SESSION_COOKIE_NAME), undefined);
      assertPasswordNotExposed(response, INVALID_PASSWORD);
    },
  )();
});

test("unavailable authentication redirects with 303 to not configured", async () => {
  const database = await createCredentialDatabase();

  await withLoginEnvironment(
    { database },
    async () => {
      const post = await getPostHandler();
      const response = await post(createLoginRequest(INVALID_PASSWORD));

      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost/admin/login?error=not_configured",
      );
      assert.equal(response.cookies.get(ADMIN_SESSION_COOKIE_NAME), undefined);
      assertPasswordNotExposed(response, INVALID_PASSWORD);
    },
  )();
});
