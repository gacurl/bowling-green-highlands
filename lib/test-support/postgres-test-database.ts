import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type {
  DatabaseAccess,
  DatabaseQueryResult,
  DatabaseQueryable,
} from "../server/database";

function getTestDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for persistence tests");
  }

  return databaseUrl;
}

function toDatabaseQueryResult<Row>(result: {
  rowCount: number | null;
  rows: Row[];
}): DatabaseQueryResult<Row> {
  return {
    rowCount: result.rowCount,
    rows: result.rows,
  };
}

class PostgresTestDatabase implements DatabaseAccess {
  constructor(private readonly pool: Pool) {}

  async query<Row = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ) {
    return toDatabaseQueryResult(
      await this.pool.query<Row & Record<string, unknown>>(text, values),
    );
  }

  async transaction<Result>(
    operation: (client: DatabaseQueryable) => Promise<Result>,
  ) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await operation({
        query: async <Row = Record<string, unknown>>(
          text: string,
          values: unknown[] = [],
        ) =>
          toDatabaseQueryResult(
            await client.query<Row & Record<string, unknown>>(text, values),
          ),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function createTestDatabase() {
  const schema = `bgh_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({
    allowExitOnIdle: true,
    connectionString: getTestDatabaseUrl(),
    max: 1,
  });

  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const migration = await readFile(
      path.join(
        process.cwd(),
        "db",
        "migrations",
        "0001_durable_persistence.sql",
      ),
      "utf8",
    );
    const client = await adminPool.connect();

    try {
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(migration);
    } finally {
      client.release();
    }
  } finally {
    await adminPool.end();
  }

  return new PostgresTestDatabase(
    new Pool({
      allowExitOnIdle: true,
      connectionString: getTestDatabaseUrl(),
      max: 8,
      options: `-c search_path=${schema}`,
    }),
  );
}

export function createUnavailableTestDatabase(): DatabaseAccess {
  const unavailable = async () => {
    throw new Error("Synthetic database failure");
  };

  return {
    query: unavailable,
    transaction: unavailable,
  };
}

export function failDatabaseTransactions(
  database: DatabaseAccess,
): DatabaseAccess {
  return {
    query: database.query.bind(database),
    async transaction() {
      throw new Error("Synthetic transaction failure");
    },
  };
}

export function failDatabaseMutations(database: DatabaseAccess): DatabaseAccess {
  return {
    async query<Row = Record<string, unknown>>(
      text: string,
      values: unknown[] = [],
    ) {
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(text)) {
        throw new Error("Synthetic mutation failure");
      }

      return database.query<Row>(text, values);
    },
    transaction: database.transaction.bind(database),
  };
}
