import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const ROLE_PATTERN = /^[a-z_][a-z0-9_]*$/;
const MIGRATION_LOCK_ID = 261;
const MIGRATION_TARGETS = new Set(["preview", "production"]);
const MIGRATION_TARGET_SETTING = "bgh.migration_target";
const NEON_PROJECT_ID_SETTING = "bgh.neon_project_id";
const NEON_BRANCH_ID_SETTING = "bgh.neon_branch_id";
const DATABASE_IDENTITY_SETTINGS = [
  MIGRATION_TARGET_SETTING,
  NEON_PROJECT_ID_SETTING,
  NEON_BRANCH_ID_SETTING,
];
const NEON_PROJECT_ID_PATTERN = /^[a-z0-9-]{1,60}$/;
const NEON_BRANCH_ID_PATTERN = /^br-[a-z0-9-]{1,57}$/;
const PREVIEW_RUNTIME_ROLE = "bgh_preview_app";
const TABLE_PRIVILEGES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
];
const REQUIRED_TABLE_PRIVILEGES = [
  {
    privileges: ["SELECT", "INSERT", "UPDATE"],
    table: "admin_owner_credentials",
  },
  {
    privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    table: "operator_availability",
  },
  {
    privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    table: "reservation_requests",
  },
  {
    privileges: ["SELECT", "INSERT", "UPDATE"],
    table: "homepage_content",
  },
];
const SEQUENCE_PRIVILEGES = ["USAGE", "SELECT", "UPDATE"];
const RESERVATION_SEQUENCE = "reservation_requests_sequence_id_seq";

function quoteIdentifier(identifier) {
  if (!ROLE_PATTERN.test(identifier)) {
    throw new Error("Runtime database role is invalid");
  }

  return `"${identifier}"`;
}

async function verifyRuntimePrivileges(client, runtimeRole) {
  for (const { privileges, table } of REQUIRED_TABLE_PRIVILEGES) {
    for (const privilege of TABLE_PRIVILEGES) {
      const result = await client.query(
        "SELECT has_table_privilege($1, $2, $3) AS allowed",
        [runtimeRole, table, privilege],
      );
      const expected = privileges.includes(privilege);

      if (result.rows[0]?.allowed !== expected) {
        throw new Error(
          `Runtime database role privilege mismatch: ${privilege} on ${table}`,
        );
      }
    }
  }

  for (const privilege of SEQUENCE_PRIVILEGES) {
    const result = await client.query(
      "SELECT has_sequence_privilege($1, $2, $3) AS allowed",
      [runtimeRole, RESERVATION_SEQUENCE, privilege],
    );
    const expected = privilege === "USAGE";

    if (result.rows[0]?.allowed !== expected) {
      throw new Error(
        `Runtime database role privilege mismatch: ${privilege} on ${RESERVATION_SEQUENCE}`,
      );
    }
  }
}

async function readDatabaseIdentityMarkers(client) {
  const result = await client.query(
    `
    SELECT
      split_part(configured.setting, '=', 1) AS name,
      substring(configured.setting FROM strpos(configured.setting, '=') + 1) AS value
    FROM pg_db_role_setting AS role_setting
    JOIN pg_database AS target_database
      ON target_database.oid = role_setting.setdatabase
    CROSS JOIN LATERAL unnest(role_setting.setconfig) AS configured(setting)
    WHERE target_database.datname = current_database()
      AND role_setting.setrole = 0
      AND split_part(configured.setting, '=', 1) = ANY($1::text[])
    `,
    [DATABASE_IDENTITY_SETTINGS],
  );
  const markers = new Map();

  for (const setting of DATABASE_IDENTITY_SETTINGS) {
    const values = result.rows
      .filter((row) => row.name === setting)
      .map((row) => row.value);

    if (values.length === 0) {
      throw new Error(`Database identity marker is missing: ${setting}`);
    }

    if (values.length !== 1) {
      throw new Error(`Database identity marker is ambiguous: ${setting}`);
    }

    markers.set(setting, values[0]);
  }

  return markers;
}

async function verifyDatabaseIdentity(
  client,
  { confirmProduction, expectedNeonBranchId, expectedNeonProjectId, target },
) {
  const markers = await readDatabaseIdentityMarkers(client);
  const actualTarget = markers.get(MIGRATION_TARGET_SETTING);
  const actualNeonProjectId = markers.get(NEON_PROJECT_ID_SETTING);
  const actualNeonBranchId = markers.get(NEON_BRANCH_ID_SETTING);

  if (!MIGRATION_TARGETS.has(actualTarget)) {
    throw new Error("Database migration target marker is malformed");
  }

  if (!NEON_PROJECT_ID_PATTERN.test(actualNeonProjectId)) {
    throw new Error("Database Neon project ID marker is malformed");
  }

  if (!NEON_BRANCH_ID_PATTERN.test(actualNeonBranchId)) {
    throw new Error("Database Neon branch ID marker is malformed");
  }

  if (actualTarget !== target) {
    throw new Error("Requested migration target does not match the database marker");
  }

  if (actualTarget === "production" && !confirmProduction) {
    throw new Error("Production migration requires explicit confirmation");
  }

  if (actualNeonProjectId !== expectedNeonProjectId) {
    throw new Error("Expected Neon project ID does not match the database marker");
  }

  if (actualNeonBranchId !== expectedNeonBranchId) {
    throw new Error("Expected Neon branch ID does not match the database marker");
  }
}

async function verifyRoleIsolation(client, runtimeRole) {
  const result = await client.query(
    `
      SELECT
        current_user::text AS migration_role,
        session_user::text AS session_role,
        runtime_role.rolsuper,
        runtime_role.rolcreaterole,
        runtime_role.rolcreatedb,
        runtime_role.rolreplication,
        runtime_role.rolbypassrls,
        EXISTS (
          WITH RECURSIVE set_roles(roleid, can_set) AS (
            SELECT
              membership.roleid,
              COALESCE(
                (to_jsonb(membership) ->> 'set_option')::boolean,
                true
              )
            FROM pg_auth_members AS membership
            WHERE membership.member = runtime_role.oid

            UNION ALL

            SELECT
              membership.roleid,
              set_roles.can_set AND COALESCE(
                (to_jsonb(membership) ->> 'set_option')::boolean,
                true
              )
            FROM pg_auth_members AS membership
            JOIN set_roles ON set_roles.roleid = membership.member
            WHERE set_roles.can_set
          )
          SELECT 1
          FROM set_roles
          WHERE set_roles.roleid = migration_role.oid
            AND set_roles.can_set
        ) AS can_set_migration_role,
        target_database.datdba = runtime_role.oid AS owns_database,
        has_database_privilege(runtime_role.oid, target_database.oid, 'CREATE')
          AS can_create_in_database,
        EXISTS (
          SELECT 1
          FROM pg_namespace
          WHERE has_schema_privilege(
            runtime_role.oid,
            pg_namespace.oid,
            'CREATE'
          )
        ) AS can_create_in_schema
      FROM pg_roles AS runtime_role
      JOIN pg_roles AS migration_role
        ON migration_role.rolname = current_user
      JOIN pg_database AS target_database
        ON target_database.datname = current_database()
      WHERE runtime_role.rolname = $1
    `,
    [runtimeRole],
  );

  if (result.rows.length !== 1) {
    throw new Error("Runtime database role does not exist");
  }

  const role = result.rows[0];

  if (role.migration_role === runtimeRole || role.session_role === runtimeRole) {
    throw new Error("Migration and runtime database roles must be distinct");
  }

  if (role.can_set_migration_role) {
    throw new Error("Runtime database role must not access the migration role");
  }

  if (
    role.rolsuper ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.rolreplication ||
    role.rolbypassrls
  ) {
    throw new Error("Runtime database role has elevated role attributes");
  }

  if (role.owns_database || role.can_create_in_database) {
    throw new Error("Runtime database role must not create database objects");
  }

  if (role.can_create_in_schema) {
    throw new Error("Runtime database role must not have schema CREATE privilege");
  }
}

export async function loadMigrations(
  migrationsDirectory = path.join(process.cwd(), "db", "migrations"),
) {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => MIGRATION_PATTERN.test(filename))
    .sort();

  if (filenames.length === 0) {
    throw new Error("No database migrations were found");
  }

  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");

      return {
        checksum: createHash("sha256").update(sql).digest("hex"),
        filename,
        sql,
      };
    }),
  );
}

export async function applyMigrations({
  confirmProduction = false,
  expectedNeonBranchId,
  expectedNeonProjectId,
  pool,
  runtimeRole,
  target,
  migrationsDirectory,
}) {
  if (!MIGRATION_TARGETS.has(target)) {
    throw new Error("Migration target must be preview or production");
  }

  if (!NEON_PROJECT_ID_PATTERN.test(expectedNeonProjectId ?? "")) {
    throw new Error("Expected Neon project ID is required and must be valid");
  }

  if (!NEON_BRANCH_ID_PATTERN.test(expectedNeonBranchId ?? "")) {
    throw new Error("Expected Neon branch ID is required and must be valid");
  }

  if (target === "preview" && runtimeRole !== PREVIEW_RUNTIME_ROLE) {
    throw new Error(`Preview migrations require runtime role ${PREVIEW_RUNTIME_ROLE}`);
  }

  const migrations = await loadMigrations(migrationsDirectory);
  const quotedRuntimeRole = quoteIdentifier(runtimeRole);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await verifyDatabaseIdentity(client, {
      confirmProduction,
      expectedNeonBranchId,
      expectedNeonProjectId,
      target,
    });
    await verifyRoleIsolation(client, runtimeRole);
    await client.query("SET LOCAL search_path TO public");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bgh_schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of migrations) {
      const existing = await client.query(
        "SELECT checksum FROM bgh_schema_migrations WHERE filename = $1",
        [migration.filename],
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].checksum !== migration.checksum) {
          throw new Error(`Applied migration checksum changed: ${migration.filename}`);
        }

        continue;
      }

      await client.query(migration.sql);
      await client.query(
        "INSERT INTO bgh_schema_migrations (filename, checksum) VALUES ($1, $2)",
        [migration.filename, migration.checksum],
      );
    }

    await client.query(`
      REVOKE ALL PRIVILEGES
      ON admin_owner_credentials,
         operator_availability,
         reservation_requests,
         homepage_content
      FROM ${quotedRuntimeRole}
    `);
    await client.query(`
      REVOKE ALL PRIVILEGES
      ON SEQUENCE ${RESERVATION_SEQUENCE}
      FROM ${quotedRuntimeRole}
    `);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRuntimeRole}`);
    await client.query(`
      GRANT SELECT, INSERT, UPDATE
      ON admin_owner_credentials,
         homepage_content
      TO ${quotedRuntimeRole}
    `);
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE
      ON operator_availability,
         reservation_requests
      TO ${quotedRuntimeRole}
    `);
    await client.query(`
      GRANT USAGE ON SEQUENCE ${RESERVATION_SEQUENCE}
      TO ${quotedRuntimeRole}
    `);
    await verifyRuntimePrivileges(client, runtimeRole);
    await client.query("COMMIT");

    return migrations.map(({ filename }) => filename);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original migration error.
    }

    throw error;
  } finally {
    client.release();
  }
}
