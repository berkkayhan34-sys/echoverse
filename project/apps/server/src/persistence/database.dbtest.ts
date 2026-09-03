/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations.js";
import { createFriendService } from "../features/friends/service.js";
import { createRetentionService, RETENTION_DAYS } from "./retention.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for database integration tests");

const pool = new pg.Pool({ connectionString: databaseUrl });
const testUserIds = [crypto.randomUUID(), crypto.randomUUID()];
const friendshipId = crypto.randomUUID();
const messageId = crypto.randomUUID();
const reportMemory = new Map();
const guildId = crypto.randomUUID();
const guildChannelId = crypto.randomUUID();
const oldDmMessageId = crypto.randomUUID();
const oldDmReportId = crypto.randomUUID();
const oldGuildReportId = crypto.randomUUID();
const oldAuditId = crypto.randomUUID();
const oldGuildMessageId = crypto.randomUUID();
let reportId = "";

describe("PostgreSQL persistence boundary", () => {
  beforeAll(async () => {
    await runMigrations(pool);
    await runMigrations(pool);
    await pool.query(
      `INSERT INTO echoverse_users (id, email, username, password_hash)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
      [
        testUserIds[0],
        `${testUserIds[0]}@example.test`,
        `db-${testUserIds[0]}`,
        "test-hash",
        testUserIds[1],
        `${testUserIds[1]}@example.test`,
        `db-${testUserIds[1]}`,
        "test-hash"
      ]
    );
    await pool.query(
      `INSERT INTO echoverse_friendships (id, requester_id, addressee_id, status)
       VALUES ($1, $2, $3, 'accepted')`,
      [friendshipId, testUserIds[0], testUserIds[1]]
    );
    await pool.query(
      `INSERT INTO echoverse_dm_messages (id, sender_id, recipient_id, body)
       VALUES ($1, $2, $3, 'database fixture')`,
      [messageId, testUserIds[0], testUserIds[1]]
    );
    await pool.query(`INSERT INTO echoverse_guilds (id,name,owner_id) VALUES ($1,$2,$3)`, [
      guildId,
      "Retention Guild",
      testUserIds[1]
    ]);
    await pool.query(
      `INSERT INTO echoverse_guild_channels (id,guild_id,name,channel_type,position,archived)
       VALUES ($1,$2,'general','text',0,0)`,
      [guildChannelId, guildId]
    );
  });

  afterAll(async () => {
    await pool.query("DELETE FROM echoverse_users WHERE id = ANY($1::text[])", [testUserIds]);
    await pool.end();
  });

  it("applies every migration exactly once", async () => {
    const result = await pool.query("SELECT id FROM echoverse_schema_migrations ORDER BY id");
    expect(result.rows.map((row) => row.id)).toEqual([
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
  });

  it("persists and replays a privacy-safe DM report", async () => {
    const service = createFriendService({
      pool,
      sqliteDatabase: null,
      memoryAccounts: new Map(),
      memoryFriendships: new Map(),
      memoryDmMessages: [],
      memoryDmRequests: new Map(),
      memoryDmPeerPreferences: new Map(),
      memoryDmPrivacy: new Map(),
      memoryDmReports: reportMemory,
      memoryDmConversations: new Map(),
      publicUserById: async () => null
    });
    const first = await service.createDmReport(
      testUserIds[0],
      testUserIds[1],
      messageId,
      "database report"
    );
    expect(first).toMatchObject({ created: true, report: { messageId, status: "open" } });
    const replay = await service.createDmReport(
      testUserIds[0],
      testUserIds[1],
      messageId,
      "changed"
    );
    expect(replay).toEqual({ created: false, report: first?.report });
    reportId = first?.report.id || "";
    const reportColumns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='echoverse_dm_reports'"
    );
    expect(reportColumns.rows.map((row) => row.column_name)).not.toContain("body");
  });

  it("purges expired reports and deleted message tombstones", async () => {
    const now = Date.parse("2026-09-02T00:00:00.000Z");
    const old = new Date(now - (RETENTION_DAYS + 1) * 86_400_000).toISOString();
    await pool.query(
      `INSERT INTO echoverse_dm_messages (id,sender_id,recipient_id,body,created_at,deleted_at)
       VALUES ($1,$2,$3,'', $4, $4)`,
      [oldDmMessageId, testUserIds[0], testUserIds[1], old]
    );
    await pool.query(
      `INSERT INTO echoverse_dm_reports (id,reporter_id,target_id,message_id,reason,status,created_at)
       VALUES ($1,$2,$3,$4,'old report','open',$5)`,
      [oldDmReportId, testUserIds[0], testUserIds[1], oldDmMessageId, old]
    );
    await pool.query(
      `INSERT INTO echoverse_guild_reports (id,guild_id,reporter_id,target_id,reason,status,created_at)
       VALUES ($1,$2,$3,$4,'old guild report','open',$5)`,
      [oldGuildReportId, guildId, testUserIds[0], testUserIds[1], old]
    );
    await pool.query(
      `INSERT INTO echoverse_guild_audit_events (id,guild_id,actor_id,action,target_id,metadata,created_at)
       VALUES ($1,$2,$3,'kick',$4,'{}',$5)`,
      [oldAuditId, guildId, testUserIds[1], testUserIds[0], old]
    );
    await pool.query(
      `INSERT INTO echoverse_guild_messages (id,guild_id,channel_id,sender_id,body,created_at,deleted_at)
       VALUES ($1,$2,$3,$4,'',$5,$5)`,
      [oldGuildMessageId, guildId, guildChannelId, testUserIds[0], old]
    );

    const retention = createRetentionService({
      pool,
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

    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM echoverse_dm_reports WHERE id=$1) AS dm_reports,
         (SELECT COUNT(*) FROM echoverse_guild_reports WHERE id=$2) AS guild_reports,
         (SELECT COUNT(*) FROM echoverse_guild_audit_events WHERE id=$3) AS audit_events,
         (SELECT COUNT(*) FROM echoverse_dm_messages WHERE id=$4) AS dm_messages,
         (SELECT COUNT(*) FROM echoverse_guild_messages WHERE id=$5) AS guild_messages`,
      [oldDmReportId, oldGuildReportId, oldAuditId, oldDmMessageId, oldGuildMessageId]
    );
    expect(counts.rows[0]).toEqual({
      dm_reports: "0",
      guild_reports: "0",
      audit_events: "0",
      dm_messages: "0",
      guild_messages: "0"
    });
    expect(
      (
        await pool.query("SELECT COUNT(*) AS count FROM echoverse_dm_messages WHERE id=$1", [
          messageId
        ])
      ).rows[0].count
    ).toBe("1");
  });

  it("enforces cascading user deletion for friendships and messages", async () => {
    await pool.query("DELETE FROM echoverse_users WHERE id = $1", [testUserIds[0]]);

    const relationships = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM echoverse_friendships WHERE id = $1) AS friendships,
         (SELECT COUNT(*) FROM echoverse_dm_messages WHERE id = $2) AS messages`,
      [friendshipId, messageId]
    );
    expect(relationships.rows[0]).toMatchObject({ friendships: "0", messages: "0" });
    expect(
      (
        await pool.query("SELECT COUNT(*) AS reports FROM echoverse_dm_reports WHERE id=$1", [
          reportId
        ])
      ).rows[0].reports
    ).toBe("0");
  });

  it("keeps friendship timestamps and DM metadata available after migration", async () => {
    const friendshipColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'echoverse_friendships' AND column_name = 'updated_at'`
    );
    const messageColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'echoverse_dm_messages'
         AND column_name IN ('reply_to_id', 'edited_at', 'deleted_at', 'attachment_name', 'attachment_mime', 'attachment_data', 'reactions')
       ORDER BY column_name`
    );
    const guildColumns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'echoverse_guilds' AND column_name = 'lobby_name'`
    );

    expect(friendshipColumns.rowCount).toBe(1);
    expect(guildColumns.rowCount).toBe(1);
    expect(messageColumns.rows.map((row) => row.column_name)).toEqual([
      "attachment_data",
      "attachment_mime",
      "attachment_name",
      "deleted_at",
      "edited_at",
      "reactions",
      "reply_to_id"
    ]);
  });
});
