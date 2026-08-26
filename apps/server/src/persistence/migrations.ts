/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../db/migrations");

export async function runMigrations(pool: pg.Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS echoverse_schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const files = (await readdir(migrationsDir)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const exists = await pool.query("SELECT 1 FROM echoverse_schema_migrations WHERE id=$1", [id]);
    if (exists.rowCount) continue;
    const sql = await readFile(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO echoverse_schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
