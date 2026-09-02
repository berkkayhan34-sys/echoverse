/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSqliteMigrations } from "./sqlite-migrations.js";
import {
  backupSqliteDatabase,
  openSqliteDatabase,
  restoreSqliteDatabase,
  type SqliteDatabase
} from "./sqlite.js";
import { createRetentionService, RETENTION_DAYS } from "./retention.js";

const databases: SqliteDatabase[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("SQLite persistence adapter", () => {
  it("applies the shared migration history once and enforces relationships", async () => {
    const database = await openSqliteDatabase(":memory:");
    databases.push(database);

    await runSqliteMigrations(database);
    await runSqliteMigrations(database);

    const migrations = await database.query(
      "SELECT id FROM echoverse_schema_migrations ORDER BY id"
    );
    expect(migrations.rows.map((row) => row.id)).toEqual([
      "001_initial",
      "002_dm_metadata",
      "003_friendship_updated_at",
      "004_guild_access",
      "005_guild_lobby_name",
      "006_friendship_pair_integrity",
      "007_normalize_legacy_lobby_names",
      "008_spaces_channels_messages",
      "009_guild_governance",
      "010_group_dms",
      "011_dm_requests",
      "012_dm_preferences",
      "012_guild_channel_notification_state",
      "013_dm_reports",
      "014_retention_indexes"
    ]);

    const guildColumns = await database.query("PRAGMA table_info(echoverse_guilds)");
    expect(guildColumns.rows.some((row) => row.name === "lobby_name")).toBe(true);
    const dmReportColumns = await database.query("PRAGMA table_info(echoverse_dm_reports)");
    expect(dmReportColumns.rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(["reporter_id", "target_id", "message_id", "reason", "status"])
    );

    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await database.query(
      "INSERT INTO echoverse_users (id,email,username,password_hash) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
      [
        first,
        `${first}@example.test`,
        `sqlite-${first}`,
        "hash",
        second,
        `${second}@example.test`,
        `sqlite-${second}`,
        "hash"
      ]
    );
    await database.query(
      "INSERT INTO echoverse_guilds (id,name,lobby_name,owner_id) VALUES ($1,$2,$3,$4)",
      ["migration-guild", "Migration Guild", "Lobby", first]
    );
    await database.query("UPDATE echoverse_guilds SET lobby_name=$2 WHERE id=$1", [
      "migration-guild",
      "testlooby"
    ]);
    expect(
      (
        await database.query("SELECT lobby_name FROM echoverse_guilds WHERE id=$1", [
          "migration-guild"
        ])
      ).rows[0].lobby_name
    ).toBe("testlooby");
    await database.query(
      "INSERT INTO echoverse_friendships (id,requester_id,addressee_id,status,created_at,updated_at) VALUES ($1,$2,$3,'accepted',$4,$4)",
      [crypto.randomUUID(), first, second, new Date().toISOString()]
    );
    await expect(
      database.query(
        "INSERT INTO echoverse_friendships (id,requester_id,addressee_id,status,created_at,updated_at) VALUES ($1,$2,$3,'pending',$4,$4)",
        [crypto.randomUUID(), second, first, new Date().toISOString()]
      )
    ).rejects.toThrow();
    await database.query(
      "INSERT INTO echoverse_dm_messages (id,sender_id,recipient_id,body) VALUES ($1,$2,$3,$4)",
      [crypto.randomUUID(), first, second, "unicode: ı̆🙂漢字"]
    );

    await database.query("DELETE FROM echoverse_users WHERE id=$1", [first]);
    expect(
      (await database.query("SELECT COUNT(*) AS count FROM echoverse_friendships")).rows[0].count
    ).toBe(0);
    expect(
      (await database.query("SELECT COUNT(*) AS count FROM echoverse_dm_messages")).rows[0].count
    ).toBe(0);
  });

  it("purges expired reports and deleted message tombstones", async () => {
    const database = await openSqliteDatabase(":memory:");
    databases.push(database);
    await runSqliteMigrations(database);
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const guildId = crypto.randomUUID();
    const channelId = crypto.randomUUID();
    const oldDmMessageId = crypto.randomUUID();
    const oldDmReportId = crypto.randomUUID();
    const oldGuildReportId = crypto.randomUUID();
    const oldAuditId = crypto.randomUUID();
    const oldGuildMessageId = crypto.randomUUID();
    const now = Date.parse("2026-09-02T00:00:00.000Z");
    const old = new Date(now - (RETENTION_DAYS + 1) * 86_400_000).toISOString();

    await database.query(
      "INSERT INTO echoverse_users (id,email,username,password_hash) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
      [
        first,
        `${first}@example.test`,
        `sqlite-retention-${first}`,
        "hash",
        second,
        `${second}@example.test`,
        `sqlite-retention-${second}`,
        "hash"
      ]
    );
    await database.query("INSERT INTO echoverse_guilds (id,name,owner_id) VALUES ($1,$2,$3)", [
      guildId,
      "Retention Guild",
      second
    ]);
    await database.query(
      "INSERT INTO echoverse_guild_channels (id,guild_id,name,channel_type,position,archived) VALUES ($1,$2,'general','text',0,0)",
      [channelId, guildId]
    );
    await database.query(
      "INSERT INTO echoverse_dm_messages (id,sender_id,recipient_id,body,created_at,deleted_at) VALUES ($1,$2,$3,'',$4,$4)",
      [oldDmMessageId, first, second, old]
    );
    await database.query(
      "INSERT INTO echoverse_dm_reports (id,reporter_id,target_id,message_id,reason,status,created_at) VALUES ($1,$2,$3,$4,'old','open',$5)",
      [oldDmReportId, first, second, oldDmMessageId, old]
    );
    await database.query(
      "INSERT INTO echoverse_guild_reports (id,guild_id,reporter_id,target_id,reason,status,created_at) VALUES ($1,$2,$3,$4,'old','open',$5)",
      [oldGuildReportId, guildId, first, second, old]
    );
    await database.query(
      "INSERT INTO echoverse_guild_audit_events (id,guild_id,actor_id,action,target_id,metadata,created_at) VALUES ($1,$2,$3,'kick',$4,'{}',$5)",
      [oldAuditId, guildId, second, first, old]
    );
    await database.query(
      "INSERT INTO echoverse_guild_messages (id,guild_id,channel_id,sender_id,body,created_at,deleted_at) VALUES ($1,$2,$3,$4,'',$5,$5)",
      [oldGuildMessageId, guildId, channelId, first, old]
    );

    const retention = createRetentionService({
      pool: database,
      memoryDmMessages: [],
      memoryDmReports: new Map(),
      guildAuditEvents: new Map()
    });
    await expect(retention.purgeExpiredData(now)).resolves.toMatchObject({
      dmReports: 1,
      guildReports: 1,
      guildAuditEvents: 1,
      dmMessages: 1,
      guildMessages: 1
    });
    expect(
      (
        await database.query("SELECT COUNT(*) AS count FROM echoverse_dm_reports WHERE id=$1", [
          oldDmReportId
        ])
      ).rows[0].count
    ).toBe(0);
    expect(
      (
        await database.query("SELECT COUNT(*) AS count FROM echoverse_guild_messages WHERE id=$1", [
          oldGuildMessageId
        ])
      ).rows[0].count
    ).toBe(0);
  });

  it("backs up and restores a database without losing Unicode data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "echoverse-sqlite-"));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, "source.sqlite");
    const backupPath = join(directory, "backup.sqlite");
    const restoredPath = join(directory, "restored.sqlite");
    const source = await openSqliteDatabase(sourcePath);
    databases.push(source);
    await runSqliteMigrations(source);
    await source.query(
      "INSERT INTO echoverse_users (id,email,username,password_hash) VALUES ($1,$2,$3,$4)",
      ["unicode-user", "unicode@example.test", "İstanbul🙂漢字", "hash"]
    );

    await backupSqliteDatabase(source, backupPath);
    await restoreSqliteDatabase(backupPath, restoredPath);
    const restored = await openSqliteDatabase(restoredPath);
    databases.push(restored);
    const result = await restored.query("SELECT username FROM echoverse_users WHERE id=$1", [
      "unicode-user"
    ]);
    expect(result.rows[0].username).toBe("İstanbul🙂漢字");

    await restored.query(
      "INSERT INTO echoverse_users (id,email,username,password_hash) VALUES ($1,$2,$3,$4)",
      ["rollback-user", "rollback@example.test", "rollback", "hash"]
    );
    restored.close();
    databases.splice(databases.indexOf(restored), 1);
    await restoreSqliteDatabase(backupPath, restoredPath);
    const rolledBack = await openSqliteDatabase(restoredPath);
    databases.push(rolledBack);
    expect(
      (await rolledBack.query("SELECT id FROM echoverse_users ORDER BY id")).rows.map(
        (row) => row.id
      )
    ).toEqual(["unicode-user"]);
  });
});
