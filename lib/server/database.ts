import "server-only";

import {
  Pool,
  type PoolClient,
} from "@neondatabase/serverless";

export type DatabaseQueryResult<Row> = {
  rowCount: number | null;
  rows: Row[];
};

export type DatabaseQueryable = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<DatabaseQueryResult<Row>>;
};

export type DatabaseAccess = DatabaseQueryable & {
  transaction<Result>(
    operation: (client: DatabaseQueryable) => Promise<Result>,
  ): Promise<Result>;
};

export function getDatabaseUrl(environment: NodeJS.ProcessEnv = process.env) {
  const databaseUrl =
    environment.VERCEL_ENV === "production"
      ? environment.BGH_RUNTIME_DATABASE_URL?.trim()
      : environment.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Database configuration is unavailable");
  }

  return databaseUrl;
}

function createPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: 1,
  });
}

async function queryWithClient<Row>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<DatabaseQueryResult<Row>> {
  const result = await client.query(text, values);

  return {
    rowCount: result.rowCount,
    rows: result.rows as Row[],
  };
}

const neonDatabase: DatabaseAccess = {
  async query<Row>(text: string, values: unknown[] = []) {
    const pool = createPool();

    try {
      const result = await pool.query(text, values);

      return {
        rowCount: result.rowCount,
        rows: result.rows as Row[],
      };
    } finally {
      await pool.end();
    }
  },

  async transaction<Result>(
    operation: (client: DatabaseQueryable) => Promise<Result>,
  ) {
    const pool = createPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await operation({
        query: <Row>(
          text: string,
          values: unknown[] = [],
        ) => queryWithClient<Row>(client, text, values),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }

      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  },
};

let testDatabase: DatabaseAccess | null = null;

export function setDatabaseForTests(database: DatabaseAccess | null) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test database overrides are unavailable outside tests");
  }

  testDatabase = database;
}

export function getDatabase(database?: DatabaseAccess) {
  return database ?? testDatabase ?? neonDatabase;
}
