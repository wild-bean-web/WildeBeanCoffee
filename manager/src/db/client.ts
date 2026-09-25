import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { databasePoolMax } from "./pool";
import * as schema from "./schema";

export type ManagerDatabase = PostgresJsDatabase<typeof schema>;
export type ManagerSqlClient = Sql;

type DatabaseGlobal = typeof globalThis & {
  __wildBeanManagerDb?: ManagerDatabase;
  __wildBeanManagerSql?: ManagerSqlClient;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

const readDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is required when manager database access is initialized.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must use the postgres: or postgresql: protocol.",
    );
  }

  return databaseUrl;
};

const readPoolSize = (): number => {
  const rawPoolSize = process.env.DATABASE_POOL_MAX?.trim();

  if (!rawPoolSize) {
    return 10;
  }

  const poolSize = Number(rawPoolSize);

  if (!Number.isSafeInteger(poolSize) || poolSize < 1 || poolSize > 100) {
    throw new DatabaseConfigurationError(
      "DATABASE_POOL_MAX must be an integer between 1 and 100.",
    );
  }

  return poolSize;
};

const readPrepareStatements = (): boolean => {
  const rawValue = process.env.DATABASE_PREPARE_STATEMENTS?.trim().toLowerCase();

  if (!rawValue) {
    return false;
  }

  if (rawValue === "true" || rawValue === "1") {
    return true;
  }

  if (rawValue === "false" || rawValue === "0") {
    return false;
  }

  throw new DatabaseConfigurationError(
    "DATABASE_PREPARE_STATEMENTS must be true, false, 1, or 0.",
  );
};

const initializeDatabase = (): {
  db: ManagerDatabase;
  sql: ManagerSqlClient;
} => {
  const databaseUrl = readDatabaseUrl();
  const hostname = new URL(databaseUrl).hostname;
  const sqlClient = postgres(databaseUrl, {
    max: databasePoolMax({
      serverless: process.env.VERCEL === "1",
      configured: readPoolSize(),
    }),
    idle_timeout: 5,
    max_lifetime: 60,
    prepare: readPrepareStatements(),
    ssl:
      hostname === "localhost" || hostname === "127.0.0.1"
        ? undefined
        : "require",
    connection: {
      application_name: "wild-bean-manager",
    },
  });
  const db = drizzle(sqlClient, { schema });

  databaseGlobal.__wildBeanManagerSql = sqlClient;
  databaseGlobal.__wildBeanManagerDb = db;

  return { db, sql: sqlClient };
};

const getInitializedDatabase = (): {
  db: ManagerDatabase;
  sql: ManagerSqlClient;
} => {
  const db = databaseGlobal.__wildBeanManagerDb;
  const sqlClient = databaseGlobal.__wildBeanManagerSql;

  if (db && sqlClient) {
    return { db, sql: sqlClient };
  }

  return initializeDatabase();
};

export const getDb = (): ManagerDatabase => getInitializedDatabase().db;

export const getSqlClient = (): ManagerSqlClient =>
  getInitializedDatabase().sql;

export const closeDatabase = async (): Promise<void> => {
  const sqlClient = databaseGlobal.__wildBeanManagerSql;

  databaseGlobal.__wildBeanManagerDb = undefined;
  databaseGlobal.__wildBeanManagerSql = undefined;

  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
  }
};
