import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { applyMigrations, loadMigrations } from "./migration-runner.mjs";

const { Pool } = pg;

function getTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for migration tests");
  }

  return databaseUrl;
}

async function createMigrationEnvironment() {
  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `bgh_migration_${suffix}`;
  const runtimeRole = `bgh_runtime_${suffix}`;
  const adminPool = new Pool({ connectionString: getTestDatabaseUrl() });

  await adminPool.query(`CREATE ROLE "${runtimeRole}" NOLOGIN`);
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  const databaseUrl = new URL(getTestDatabaseUrl());
  databaseUrl.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
  await pool.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");

  return {
    adminPool,
    connectionString: databaseUrl.toString(),
    databaseName,
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
      await adminPool.end();
    },
  };
}

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
  assert.equal(
    (
      await environment.pool.query(
        "SELECT count(*)::int AS count FROM bgh_schema_migrations",
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT has_schema_privilege($1, 'public', 'CREATE') AS can_create",
        [environment.runtimeRole],
      )
    ).rows[0].can_create,
    false,
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT has_table_privilege($1, 'reservation_requests', 'INSERT') AS can_insert",
        [environment.runtimeRole],
      )
    ).rows[0].can_insert,
    true,
  );
  assert.equal(
    (
      await environment.pool.query(
        "SELECT has_sequence_privilege($1, 'reservation_requests_sequence_id_seq', 'USAGE') AS can_use",
        [environment.runtimeRole],
      )
    ).rows[0].can_use,
    true,
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
