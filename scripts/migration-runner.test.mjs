import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  applyMigrations as applyMigrationsAtTarget,
  loadMigrations,
} from "./migration-runner.mjs";

const { Pool } = pg;
const TABLE_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
];
const EXPECTED_TABLE_PRIVILEGES = {
  admin_owner_credentials: ["SELECT", "INSERT", "UPDATE"],
  operator_availability: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  reservation_requests: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  homepage_content: ["SELECT", "INSERT", "UPDATE"],
};
const SEQUENCE_PRIVILEGES = ["USAGE", "SELECT", "UPDATE"];
const RESERVATION_SEQUENCE = "reservation_requests_sequence_id_seq";
const PREVIEW_RUNTIME_ROLE = "bgh_preview_app";
const TEST_NEON_PROJECT_ID = "bgh-test-project";
const TEST_PREVIEW_BRANCH_ID = "br-preview-test";
const TEST_PRODUCTION_BRANCH_ID = "br-production-test";

function applyMigrations(options) {
  return applyMigrationsAtTarget({
    expectedNeonBranchId: TEST_PREVIEW_BRANCH_ID,
    expectedNeonProjectId: TEST_NEON_PROJECT_ID,
    target: "preview",
    ...options,
  });
}

function applyProductionMigrations(options) {
  return applyMigrationsAtTarget({
    confirmProduction: true,
    expectedNeonBranchId: TEST_PRODUCTION_BRANCH_ID,
    expectedNeonProjectId: TEST_NEON_PROJECT_ID,
    target: "production",
    ...options,
  });
}

function getTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for migration tests");
  }

  return databaseUrl;
}

async function createMigrationEnvironment({
  branchMarker = TEST_PREVIEW_BRANCH_ID,
  marker = "preview",
  projectMarker = TEST_NEON_PROJECT_ID,
  target = "preview",
} = {}) {
  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `bgh_migration_${suffix}`;
  const inheritedRole = `bgh_inherited_${suffix}`;
  const runtimeRole =
    target === "preview" ? PREVIEW_RUNTIME_ROLE : `bgh_runtime_${suffix}`;
  const adminPool = new Pool({ connectionString: getTestDatabaseUrl() });

  await adminPool.query(`CREATE ROLE "${inheritedRole}" NOLOGIN`);
  await adminPool.query(`CREATE ROLE "${runtimeRole}" NOLOGIN`);
  await adminPool.query(`GRANT "${inheritedRole}" TO "${runtimeRole}"`);
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  for (const [setting, value] of [
    ["bgh.migration_target", marker],
    ["bgh.neon_project_id", projectMarker],
    ["bgh.neon_branch_id", branchMarker],
  ]) {
    if (value !== null) {
      if (!/^[A-Za-z0-9-]+$/.test(value)) {
        throw new Error("Invalid synthetic database identity marker");
      }

      await adminPool.query(
        `ALTER DATABASE "${databaseName}" SET ${setting} TO '${value}'`,
      );
    }
  }

  const databaseUrl = new URL(getTestDatabaseUrl());
  databaseUrl.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
  await pool.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");

  return {
    adminPool,
    connectionString: databaseUrl.toString(),
    databaseName,
    inheritedRole,
    pool,
    runtimeRole,
    async cleanup() {
      await pool.end();
      await adminPool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
        [databaseName],
      );
      await adminPool.query(`DROP DATABASE "${databaseName}"`);
      await adminPool.query(`DROP ROLE "${runtimeRole}"`);
      await adminPool.query(`DROP ROLE "${inheritedRole}"`);
      await adminPool.end();
    },
  };
}

async function assertNoMigrationState(pool) {
  const result = await pool.query(`
    SELECT
      to_regclass('public.bgh_schema_migrations') AS migration_table,
      to_regclass('public.admin_owner_credentials') AS credential_table
  `);

  assert.equal(result.rows[0].migration_table, null);
  assert.equal(result.rows[0].credential_table, null);
}

function createMarkerResultPool(rows) {
  const queries = [];
  const client = {
    async query(text) {
      queries.push(text);

      if (text.includes("FROM pg_db_role_setting")) {
        return { rows };
      }

      return { rows: [] };
    },
    release() {},
  };

  return {
    pool: {
      async connect() {
        return client;
      },
    },
    queries,
  };
}

async function assertEffectiveRuntimePrivileges(pool, runtimeRole) {
  const schemaPrivileges = await pool.query(
    `
      SELECT
        has_schema_privilege($1, 'public', 'USAGE') AS can_use,
        has_schema_privilege($1, 'public', 'CREATE') AS can_create
    `,
    [runtimeRole],
  );

  assert.equal(schemaPrivileges.rows[0].can_use, true);
  assert.equal(schemaPrivileges.rows[0].can_create, false);

  for (const [table, expectedPrivileges] of Object.entries(
    EXPECTED_TABLE_PRIVILEGES,
  )) {
    for (const privilege of TABLE_PRIVILEGES) {
      const result = await pool.query(
        "SELECT has_table_privilege($1, $2, $3) AS allowed",
        [runtimeRole, table, privilege],
      );

      assert.equal(
        result.rows[0].allowed,
        expectedPrivileges.includes(privilege),
        `${privilege} on ${table}`,
      );
    }
  }

  for (const privilege of SEQUENCE_PRIVILEGES) {
    const result = await pool.query(
      "SELECT has_sequence_privilege($1, $2, $3) AS allowed",
      [runtimeRole, RESERVATION_SEQUENCE, privilege],
    );

    assert.equal(
      result.rows[0].allowed,
      privilege === "USAGE",
      `${privilege} on ${RESERVATION_SEQUENCE}`,
    );
  }
}

test("migration execution requires an explicit valid target", async () => {
  const pool = {
    async connect() {
      assert.fail("invalid targets must fail before connecting");
    },
  };

  await assert.rejects(
    applyMigrationsAtTarget({ pool, runtimeRole: "bgh_runtime" }),
    /target must be preview or production/,
  );
  await assert.rejects(
    applyMigrationsAtTarget({
      pool,
      runtimeRole: "bgh_runtime",
      target: "staging",
    }),
    /target must be preview or production/,
  );
});

test("migration execution requires explicit valid expected Neon IDs", async () => {
  const pool = {
    async connect() {
      assert.fail("invalid expected IDs must fail before connecting");
    },
  };
  const cases = [
    { expectedNeonProjectId: undefined },
    { expectedNeonProjectId: "INVALID" },
    { expectedNeonBranchId: undefined },
    { expectedNeonBranchId: "preview" },
  ];

  for (const overrides of cases) {
    await assert.rejects(
      applyMigrationsAtTarget({
        expectedNeonBranchId: TEST_PREVIEW_BRANCH_ID,
        expectedNeonProjectId: TEST_NEON_PROJECT_ID,
        pool,
        runtimeRole: PREVIEW_RUNTIME_ROLE,
        target: "preview",
        ...overrides,
      }),
      /Expected Neon (project|branch) ID is required and must be valid/,
    );
  }
});

test("Preview migrations require the fixed Preview runtime role", async () => {
  const pool = {
    async connect() {
      assert.fail("an invalid Preview runtime role must fail before connecting");
    },
  };

  await assert.rejects(
    applyMigrations({ pool, runtimeRole: "another_runtime_role" }),
    /Preview migrations require runtime role bgh_preview_app/,
  );
});

test("missing and malformed database target markers fail before writes", async () => {
  for (const [marker, expectedError] of [
    [null, /marker is missing/],
    ["staging", /marker is malformed/],
  ]) {
    const environment = await createMigrationEnvironment({ marker });

    try {
      await assert.rejects(
        applyMigrations({
          pool: environment.pool,
          runtimeRole: environment.runtimeRole,
        }),
        expectedError,
      );
      await assertNoMigrationState(environment.pool);
    } finally {
      await environment.cleanup();
    }
  }
});

test("ambiguous database identity markers fail before writes", async () => {
  const baseRows = [
    { name: "bgh.migration_target", value: "preview" },
    { name: "bgh.neon_project_id", value: TEST_NEON_PROJECT_ID },
    { name: "bgh.neon_branch_id", value: TEST_PREVIEW_BRANCH_ID },
  ];

  for (const duplicate of [
    { name: "bgh.migration_target", value: "production" },
    { name: "bgh.neon_project_id", value: "another-project" },
    { name: "bgh.neon_branch_id", value: "br-another-branch" },
  ]) {
    const markerResult = createMarkerResultPool([...baseRows, duplicate]);

    await assert.rejects(
      applyMigrations({
        pool: markerResult.pool,
        runtimeRole: PREVIEW_RUNTIME_ROLE,
      }),
      /identity marker is ambiguous/,
    );
    assert.equal(
      markerResult.queries.some((query) => query.includes("CREATE TABLE")),
      false,
    );
  }
});

test("Neon identity markers are required, valid, and target-specific", async () => {
  const cases = [
    {
      options: { projectMarker: null },
      expectedError: /marker is missing: bgh.neon_project_id/,
    },
    {
      options: { branchMarker: null },
      expectedError: /marker is missing: bgh.neon_branch_id/,
    },
    {
      options: { projectMarker: "INVALID" },
      expectedError: /project ID marker is malformed/,
    },
    {
      options: { branchMarker: "preview" },
      expectedError: /branch ID marker is malformed/,
    },
    {
      options: { projectMarker: "copied-production-project" },
      expectedError: /project ID does not match/,
    },
    {
      options: { branchMarker: TEST_PRODUCTION_BRANCH_ID },
      expectedError: /branch ID does not match/,
    },
  ];

  for (const { expectedError, options } of cases) {
    const environment = await createMigrationEnvironment(options);

    try {
      await assert.rejects(
        applyMigrations({
          pool: environment.pool,
          runtimeRole: environment.runtimeRole,
        }),
        expectedError,
      );
      await assertNoMigrationState(environment.pool);
    } finally {
      await environment.cleanup();
    }
  }
});

test("database target mismatch and unconfirmed Production fail before writes", async () => {
  const environment = await createMigrationEnvironment({
    branchMarker: TEST_PRODUCTION_BRANCH_ID,
    marker: "production",
  });

  try {
    await assert.rejects(
      applyMigrations({
        pool: environment.pool,
        runtimeRole: environment.runtimeRole,
      }),
      /does not match/,
    );
    await assertNoMigrationState(environment.pool);

    await assert.rejects(
      applyMigrationsAtTarget({
        expectedNeonBranchId: TEST_PRODUCTION_BRANCH_ID,
        expectedNeonProjectId: TEST_NEON_PROJECT_ID,
        pool: environment.pool,
        runtimeRole: environment.runtimeRole,
        target: "production",
      }),
      /requires explicit confirmation/,
    );
    await assertNoMigrationState(environment.pool);
  } finally {
    await environment.cleanup();
  }
});

test("database-scoped target ignores session and role spoofing", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);
  const client = await environment.pool.connect();
  const identifiers = await client.query(`
    SELECT
      quote_ident(current_user) AS role,
      quote_ident(current_database()) AS database
  `);

  await client.query(
    `ALTER ROLE ${identifiers.rows[0].role} IN DATABASE ${identifiers.rows[0].database} ` +
      "SET bgh.migration_target TO 'production'",
  );
  await client.query(
    `ALTER ROLE ${identifiers.rows[0].role} IN DATABASE ${identifiers.rows[0].database} ` +
      "SET bgh.neon_project_id TO 'spoofed-project'",
  );
  await client.query(
    `ALTER ROLE ${identifiers.rows[0].role} IN DATABASE ${identifiers.rows[0].database} ` +
      "SET bgh.neon_branch_id TO 'br-spoofed-branch'",
  );
  await client.query("SET bgh.migration_target TO 'production'");
  await client.query("SET bgh.neon_project_id TO 'spoofed-project'");
  await client.query("SET bgh.neon_branch_id TO 'br-spoofed-branch'");
  await applyMigrations({
    pool: {
      async connect() {
        return client;
      },
    },
    runtimeRole: environment.runtimeRole,
  });

  assert.equal(
    (
      await environment.pool.query(
        "SELECT count(*)::int AS count FROM bgh_schema_migrations",
      )
    ).rows[0].count,
    1,
  );
});

test("confirmed Production target applies migrations", async (t) => {
  const environment = await createMigrationEnvironment({
    branchMarker: TEST_PRODUCTION_BRANCH_ID,
    marker: "production",
    target: "production",
  });
  t.after(environment.cleanup);

  const result = await applyProductionMigrations({
    pool: environment.pool,
    runtimeRole: environment.runtimeRole,
  });

  assert.deepEqual(result, ["0001_durable_persistence.sql"]);
  await assertEffectiveRuntimePrivileges(
    environment.pool,
    environment.runtimeRole,
  );
});

test("migration and runtime roles must be distinct", async (t) => {
  const environment = await createMigrationEnvironment({
    branchMarker: TEST_PRODUCTION_BRANCH_ID,
    marker: "production",
    target: "production",
  });
  t.after(environment.cleanup);
  const identity = await environment.pool.query(
    "SELECT current_user::text AS migration_role",
  );

  await assert.rejects(
    applyProductionMigrations({
      pool: environment.pool,
      runtimeRole: identity.rows[0].migration_role,
    }),
    /Migration and runtime database roles must be distinct/,
  );
  await assertNoMigrationState(environment.pool);
});

test("runtime SET ROLE access to the migration role fails before writes", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);
  const identity = await environment.pool.query(
    "SELECT quote_ident(current_user) AS migration_role",
  );

  await environment.pool.query(
    `GRANT ${identity.rows[0].migration_role} TO "${PREVIEW_RUNTIME_ROLE}"`,
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /must not access the migration role/,
  );
  await assertNoMigrationState(environment.pool);
});

test("elevated runtime role attributes fail before writes", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);

  for (const [elevatedAttribute, resetAttribute] of [
    ["SUPERUSER", "NOSUPERUSER"],
    ["CREATEROLE", "NOCREATEROLE"],
    ["CREATEDB", "NOCREATEDB"],
    ["REPLICATION", "NOREPLICATION"],
    ["BYPASSRLS", "NOBYPASSRLS"],
  ]) {
    await environment.pool.query(
      `ALTER ROLE "${PREVIEW_RUNTIME_ROLE}" ${elevatedAttribute}`,
    );

    try {
      await assert.rejects(
        applyMigrations({
          pool: environment.pool,
          runtimeRole: environment.runtimeRole,
        }),
        /has elevated role attributes/,
      );
      await assertNoMigrationState(environment.pool);
    } finally {
      await environment.pool.query(
        `ALTER ROLE "${PREVIEW_RUNTIME_ROLE}" ${resetAttribute}`,
      );
    }
  }
});

test("runtime database and schema CREATE fail before writes", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);

  await environment.pool.query(
    `GRANT CREATE ON DATABASE "${environment.databaseName}" TO "${PREVIEW_RUNTIME_ROLE}"`,
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /must not create database objects/,
  );
  await assertNoMigrationState(environment.pool);
  await environment.pool.query(
    `REVOKE CREATE ON DATABASE "${environment.databaseName}" FROM "${PREVIEW_RUNTIME_ROLE}"`,
  );

  await environment.pool.query(
    `GRANT CREATE ON SCHEMA public TO "${PREVIEW_RUNTIME_ROLE}"`,
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /must not have schema CREATE privilege/,
  );
  await assertNoMigrationState(environment.pool);
  await environment.pool.query(
    `REVOKE CREATE ON SCHEMA public FROM "${PREVIEW_RUNTIME_ROLE}"`,
  );

  await environment.pool.query("CREATE SCHEMA runtime_create_test");
  await environment.pool.query(
    `GRANT CREATE ON SCHEMA runtime_create_test TO "${PREVIEW_RUNTIME_ROLE}"`,
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /must not have schema CREATE privilege/,
  );
  await assertNoMigrationState(environment.pool);
});

test("migrations are repeatable, serialized, and grant only runtime DML", async (t) => {
  const environment = await createMigrationEnvironment();

  const secondPool = new Pool({
    connectionString: environment.connectionString,
    max: 1,
  });
  t.after(async () => {
    await secondPool.end();
    await environment.cleanup();
  });

  const results = await Promise.all([
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    applyMigrations({
      pool: secondPool,
      runtimeRole: environment.runtimeRole,
    }),
  ]);

  assert.deepEqual(results[0], ["0001_durable_persistence.sql"]);
  assert.deepEqual(results[1], ["0001_durable_persistence.sql"]);
  await environment.pool.query(`
    GRANT ALL PRIVILEGES
    ON admin_owner_credentials,
       operator_availability,
       reservation_requests,
       homepage_content
    TO "${environment.runtimeRole}"
  `);
  await environment.pool.query(`
    GRANT ALL PRIVILEGES
    ON SEQUENCE ${RESERVATION_SEQUENCE}
    TO "${environment.runtimeRole}"
  `);
  await applyMigrations({
    pool: environment.pool,
    runtimeRole: environment.runtimeRole,
  });

  assert.equal(
    (
      await environment.pool.query(
        "SELECT count(*)::int AS count FROM bgh_schema_migrations",
      )
    ).rows[0].count,
    1,
  );
  await assertEffectiveRuntimePrivileges(
    environment.pool,
    environment.runtimeRole,
  );
});

test("migrations fail closed on inherited or PUBLIC excess privileges", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);
  await applyMigrations({
    pool: environment.pool,
    runtimeRole: environment.runtimeRole,
  });

  await environment.pool.query(
    "GRANT DELETE ON admin_owner_credentials TO PUBLIC",
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /DELETE on admin_owner_credentials/,
  );
  await environment.pool.query(
    "REVOKE DELETE ON admin_owner_credentials FROM PUBLIC",
  );
  await applyMigrations({
    pool: environment.pool,
    runtimeRole: environment.runtimeRole,
  });

  await environment.pool.query(
    `GRANT DELETE ON homepage_content TO "${environment.inheritedRole}"`,
  );
  await assert.rejects(
    applyMigrations({
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /DELETE on homepage_content/,
  );
});

test("changed migration checksums fail without changing applied state", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);
  await applyMigrations({
    pool: environment.pool,
    runtimeRole: environment.runtimeRole,
  });

  const migrationsDirectory = await mkdtemp(
    path.join(tmpdir(), "bgh-migrations-checksum-"),
  );
  t.after(() => rm(migrationsDirectory, { force: true, recursive: true }));
  const [migration] = await loadMigrations();
  await writeFile(
    path.join(migrationsDirectory, migration.filename),
    `${migration.sql}\n-- changed\n`,
    "utf8",
  );

  await assert.rejects(
    applyMigrations({
      migrationsDirectory,
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
    /checksum changed/,
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT count(*)::int AS count FROM bgh_schema_migrations",
      )
    ).rows[0].count,
    1,
  );
});

test("a failing migration rolls back schema and migration records", async (t) => {
  const environment = await createMigrationEnvironment();
  t.after(environment.cleanup);
  const migrationsDirectory = await mkdtemp(
    path.join(tmpdir(), "bgh-migrations-rollback-"),
  );
  t.after(() => rm(migrationsDirectory, { force: true, recursive: true }));
  await writeFile(
    path.join(migrationsDirectory, "0001_failing.sql"),
    "CREATE TABLE should_rollback (id integer); SELECT * FROM missing_table;\n",
    "utf8",
  );

  await assert.rejects(
    applyMigrations({
      migrationsDirectory,
      pool: environment.pool,
      runtimeRole: environment.runtimeRole,
    }),
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT to_regclass('public.should_rollback') AS table_name",
      )
    ).rows[0].table_name,
    null,
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT to_regclass('public.bgh_schema_migrations') AS table_name",
      )
    ).rows[0].table_name,
    null,
  );
});
