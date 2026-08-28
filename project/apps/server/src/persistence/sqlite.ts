/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { copyFile, mkdir } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type PersistenceQueryResult = {
  rows: Record<string, any>[];
  rowCount: number;
};

export type PersistenceDatabase = {
  query(sql: string, values?: unknown[]): Promise<PersistenceQueryResult>;
};

function sqliteStatement(sql: string, values: unknown[]) {
  const parameters: unknown[] = [];
  const normalized = sql
    .replace(/::(?:jsonb|text\[\])/g, "")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\$(\d+)/g, (_match, index: string) => {
      parameters.push(values[Number(index) - 1]);
      return "?";
    });

  return { sql: normalized, parameters };
}

function isReadQuery(sql: string) {
  return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql);
}

export class SqliteDatabase implements PersistenceDatabase {
  readonly raw: Database.Database;
  readonly filename: string;

  constructor(filename: string) {
    this.filename = filename;
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.raw = new Database(filename, { timeout: 5_000 });
    // SQLite's built-in LOWER() is ASCII-oriented; keep search behavior
    // consistent with the locale-aware in-memory path for Unicode usernames.
    this.raw.function("echoverse_search_key", (value: unknown, locale: unknown) =>
      String(value ?? "")
        .normalize("NFKC")
        .toLocaleLowerCase(String(locale).toLowerCase().startsWith("tr") ? "tr-TR" : "en-US")
    );
    this.raw.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  }

  async query(sql: string, values: unknown[] = []): Promise<PersistenceQueryResult> {
    const statement = sqliteStatement(sql, values);
    const prepared = this.raw.prepare(statement.sql);
    if (isReadQuery(statement.sql)) {
      const rows = prepared.all(...(statement.parameters as any[])) as Record<string, any>[];
      return { rows, rowCount: rows.length };
    }

    const result = prepared.run(...(statement.parameters as any[]));
    return { rows: [], rowCount: Number(result.changes) };
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  close() {
    if (!this.raw.open) return;
    this.raw.close();
  }
}

export async function openSqliteDatabase(filename: string) {
  if (filename !== ":memory:") {
    await mkdir(dirname(filename), { recursive: true });
  }
  return new SqliteDatabase(filename);
}

export async function backupSqliteDatabase(database: SqliteDatabase, targetPath: string) {
  if (database.filename === ":memory:") {
    throw new Error("File-backed SQLite database required for backup");
  }
  await mkdir(dirname(targetPath), { recursive: true });
  database.raw.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  await copyFile(database.filename, targetPath);
  return targetPath;
}

export async function restoreSqliteDatabase(backupPath: string, targetPath: string) {
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(backupPath, targetPath);
  return targetPath;
}
