import { Pool } from "@neondatabase/serverless";
import { applyMigrations } from "./migration-runner.mjs";

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const target = readArgument("--target");
const runtimeRole = readArgument("--runtime-role");
const confirmsProduction = process.argv.includes("--confirm-production");
const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL?.trim();

if (target !== "preview" && target !== "production") {
  throw new Error("Use --target preview or --target production");
}

const targetEnvironmentName = target.toUpperCase();
const expectedNeonProjectId =
  process.env[`BGH_${targetEnvironmentName}_NEON_PROJECT_ID`]?.trim();
const expectedNeonBranchId =
  process.env[`BGH_${targetEnvironmentName}_NEON_BRANCH_ID`]?.trim();

if (!expectedNeonProjectId) {
  throw new Error(`BGH_${targetEnvironmentName}_NEON_PROJECT_ID is required`);
}

if (!expectedNeonBranchId) {
  throw new Error(`BGH_${targetEnvironmentName}_NEON_BRANCH_ID is required`);
}

if (!runtimeRole) {
  throw new Error("Use --runtime-role with the environment's runtime role");
}

if (target === "production" && !confirmsProduction) {
  throw new Error("Production migration requires --confirm-production");
}

if (!migrationDatabaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL is required");
}

if (migrationDatabaseUrl === process.env.DATABASE_URL?.trim()) {
  throw new Error("Migration and runtime database credentials must be separate");
}

const pool = new Pool({
  connectionString: migrationDatabaseUrl,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  max: 1,
});

try {
  const appliedMigrations = await applyMigrations({
    confirmProduction: confirmsProduction,
    expectedNeonBranchId,
    expectedNeonProjectId,
    pool,
    runtimeRole,
    target,
  });
  process.stdout.write(
    `Verified ${appliedMigrations.length} migration(s) for ${target}.\n`,
  );
} finally {
  await pool.end();
}
