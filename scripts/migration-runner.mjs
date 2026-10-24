import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const ROLE_PATTERN = /^[a-z_][a-z0-9_]*$/;
const MIGRATION_LOCK_ID = 261;
const MIGRATION_TARGETS = new Set(["preview", "production"]);
const MIGRATION_TARGET_SETTING = "bgh.migration_target";
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

async function verifyMigrationTarget(client, target, confirmProduction) {
  const result = await client.query(`
    SELECT substring(configured.setting FROM length('${MIGRATION_TARGET_SETTING}=') + 1)
      AS target
    FROM pg_db_role_setting AS role_setting
    JOIN pg_database AS target_database
      ON target_database.oid = role_setting.setdatabase
    CROSS JOIN LATERAL unnest(role_setting.setconfig) AS configured(setting)
    WHERE target_database.datname = current_database()
      AND role_setting.setrole = 0
      AND split_part(configured.setting, '=', 1) = '${MIGRATION_TARGET_SETTING}'
  `);

  if (result.rows.length === 0) {
    throw new Error("Database migration target marker is missing");
  }

  if (result.rows.length !== 1) {
    throw new Error("Database migration target marker is ambiguous");
  }

  const actualTarget = result.rows[0].target;

  if (!MIGRATION_TARGETS.has(actualTarget)) {
    throw new Error("Database migration target marker is malformed");
  }

  if (actualTarget !== target) {
    throw new Error("Requested migration target does not match the database marker");
  }

  if (actualTarget === "production" && !confirmProduction) {
    throw new Error("Production migration requires explicit confirmation");
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
  pool,
  runtimeRole,
  target,
  migrationsDirectory,
}) {
  if (!MIGRATION_TARGETS.has(target)) {
    throw new Error("Migration target must be preview or production");
  }

  const migrations = await loadMigrations(migrationsDirectory);
  const quotedRuntimeRole = quoteIdentifier(runtimeRole);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await verifyMigrationTarget(client, target, confirmProduction);
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

    const roleResult = await client.query(
      "SELECT has_schema_privilege($1, current_schema(), 'CREATE') AS can_create",
      [runtimeRole],
    );

    if (roleResult.rows.length !== 1) {
      throw new Error("Runtime database role does not exist");
    }

    if (roleResult.rows[0].can_create) {
      throw new Error("Runtime database role must not have schema CREATE privilege");
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
