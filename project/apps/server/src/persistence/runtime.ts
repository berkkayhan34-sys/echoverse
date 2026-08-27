/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import pg from "pg";
import { runMigrations } from "./migrations.js";
import { type PersistenceDatabase, SqliteDatabase } from "./sqlite.js";
import { runSqliteMigrations } from "./sqlite-migrations.js";

type PersistenceRuntimeConfig = {
  databaseUrl?: string;
  sqlitePath?: string;
  databaseSslRejectUnauthorized: boolean;
  nodeEnv: "development" | "test" | "production";
};

export type PersistenceRuntime = {
  postgresPool: pg.Pool | null;
  sqliteDatabase: SqliteDatabase | null;
  pool: PersistenceDatabase | null;
  initDatabase: () => Promise<void>;
  closeDatabase: () => Promise<void>;
};

/**
 * Owns database selection and lifecycle so feature modules depend on the
 * persistence contract rather than on process bootstrap details.
 */
export function createPersistenceRuntime(config: PersistenceRuntimeConfig): PersistenceRuntime {
  const postgresPool = config.databaseUrl
    ? new pg.Pool({
        connectionString: config.databaseUrl,
        ssl:
          config.nodeEnv === "production"
            ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
            : undefined
      })
    : null;
  const sqliteDatabase = config.sqlitePath ? new SqliteDatabase(config.sqlitePath) : null;
  const pool: PersistenceDatabase | null = postgresPool || sqliteDatabase;

  async function initDatabase() {
    if (!pool) {
      console.log("echoverse.accounts.memory_fallback");
      return;
    }
    if (postgresPool) {
      await runMigrations(postgresPool);
      console.log("echoverse.accounts.postgresql_ready");
      return;
    }
    await runSqliteMigrations(sqliteDatabase!);
    console.log("echoverse.accounts.sqlite_ready");
  }

  async function closeDatabase() {
    sqliteDatabase?.close();
    await postgresPool?.end();
  }

  return { postgresPool, sqliteDatabase, pool, initDatabase, closeDatabase };
}
