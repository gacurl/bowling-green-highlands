import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseUrl } from "./database";

const PRODUCTION_DATABASE_URL =
  "postgresql://synthetic-production.invalid/bgh_production";
const STANDARD_DATABASE_URL =
  "postgresql://synthetic-standard.invalid/bgh_standard";

test("Vercel Production selects the dedicated runtime credential", () => {
  assert.equal(
    getDatabaseUrl({
      BGH_RUNTIME_DATABASE_URL: `  ${PRODUCTION_DATABASE_URL}  `,
      DATABASE_URL: STANDARD_DATABASE_URL,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    }),
    PRODUCTION_DATABASE_URL,
  );
});

test("Vercel Production fails closed without its runtime credential", async (t) => {
  for (const runtimeDatabaseUrl of [undefined, "   "]) {
    await t.test(
      runtimeDatabaseUrl === undefined ? "missing" : "blank",
      () => {
        assert.throws(
          () =>
            getDatabaseUrl({
              BGH_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
              DATABASE_URL: STANDARD_DATABASE_URL,
              NODE_ENV: "production",
              VERCEL_ENV: "production",
            }),
          new Error("Database configuration is unavailable"),
        );
      },
    );
  }
});

test("Vercel Preview retains DATABASE_URL when NODE_ENV is production", () => {
  assert.equal(
    getDatabaseUrl({
      BGH_RUNTIME_DATABASE_URL: PRODUCTION_DATABASE_URL,
      DATABASE_URL: `  ${STANDARD_DATABASE_URL}  `,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    }),
    STANDARD_DATABASE_URL,
  );
});

test("local development retains and trims DATABASE_URL", () => {
  assert.equal(
    getDatabaseUrl({
      BGH_RUNTIME_DATABASE_URL: PRODUCTION_DATABASE_URL,
      DATABASE_URL: `  ${STANDARD_DATABASE_URL}  `,
      NODE_ENV: "development",
    }),
    STANDARD_DATABASE_URL,
  );
});

test("tests retain and trim DATABASE_URL", () => {
  assert.equal(
    getDatabaseUrl({
      BGH_RUNTIME_DATABASE_URL: PRODUCTION_DATABASE_URL,
      DATABASE_URL: `  ${STANDARD_DATABASE_URL}  `,
      NODE_ENV: "test",
    }),
    STANDARD_DATABASE_URL,
  );
});
