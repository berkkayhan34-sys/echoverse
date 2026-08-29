/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for database integration tests");

const pool = new pg.Pool({ connectionString: databaseUrl });
const testUserIds = [crypto.randomUUID(), crypto.randomUUID()];
const friendshipId = crypto.randomUUID();
const messageId = crypto.randomUUID();

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
      "009_guild_governance"
    ]);
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
