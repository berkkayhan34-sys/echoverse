/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SqliteDatabase } from "./sqlite.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../db/migrations/sqlite");

export async function runSqliteMigrations(database: SqliteDatabase) {
  database.exec(`CREATE TABLE IF NOT EXISTS echoverse_schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const exists = await database.query("SELECT 1 FROM echoverse_schema_migrations WHERE id=$1", [
      id
    ]);
    if (exists.rowCount) continue;

    const sql = await readFile(join(migrationsDir, file), "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      await database.query("INSERT INTO echoverse_schema_migrations (id) VALUES ($1)", [id]);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
