/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { createGuildNotificationService } from "./service.js";
import { runSqliteMigrations } from "../../persistence/sqlite-migrations.js";
import { openSqliteDatabase } from "../../persistence/sqlite.js";

describe("guild notification state", () => {
  it("defaults visible channels to enabled and counts only other users", async () => {
    const service = createGuildNotificationService({
      pool: null,
      memoryState: new Map(),
      memoryMessages: [
        {
          id: "one",
          guildId: "guild-1",
          channelId: "guild-1:general",
          senderId: "member-2",
          body: "hello",
          createdAt: "2026-08-31T18:00:00.000Z"
        },
        {
          id: "two",
          guildId: "guild-1",
          channelId: "guild-1:general",
          senderId: "member-1",
          body: "self",
          createdAt: "2026-08-31T20:01:00.000Z"
        }
      ]
    });

    await expect(service.getState("member-1", "guild-1", ["guild-1:general"])).resolves.toEqual({
      guildId: "guild-1",
      preferences: [{ channelId: "guild-1:general", level: "all" }],
      unread: [{ channelId: "guild-1:general", unreadCount: 1 }]
    });
  });

  it("persists mute and read transitions without affecting another channel", async () => {
    const memoryState = new Map();
    const service = createGuildNotificationService({
      pool: null,
      memoryState,
      memoryMessages: [
        {
          id: "one",
          guildId: "guild-1",
          channelId: "guild-1:general",
          senderId: "member-2",
          body: "hello",
          createdAt: "2026-08-31T18:00:00.000Z"
        },
        {
          id: "two",
          guildId: "guild-1",
          channelId: "guild-1:music",
          senderId: "member-2",
          body: "music",
          createdAt: "2026-08-31T20:00:00.000Z"
        }
      ]
    });

    await service.setLevel("member-1", "guild-1", "guild-1:general", "none");
    expect(await service.getUnreadCount("member-1", "guild-1", "guild-1:general")).toBe(0);
    expect(await service.getUnreadCount("member-1", "guild-1", "guild-1:music")).toBe(1);

    await service.setLevel("member-1", "guild-1", "guild-1:general", "all");
    await service.markRead("member-1", "guild-1", "guild-1:general");
    expect(await service.getUnreadCount("member-1", "guild-1", "guild-1:general")).toBe(0);
    expect(memoryState.get("member-1:guild-1:guild-1:general")?.lastReadAt).toEqual(
      expect.any(String)
    );
  });

  it("uses the same upsert and unread query contract on SQLite", async () => {
    const database = await openSqliteDatabase(":memory:");
    await runSqliteMigrations(database);
    await database.query(
      `INSERT INTO echoverse_users (id,email,username,password_hash) VALUES
       ('owner','owner@example.test','owner','hash'),('member','member@example.test','member','hash')`
    );
    await database.query(
      `INSERT INTO echoverse_guilds (id,name,owner_id) VALUES ('guild-db','Guild','owner')`
    );
    await database.query(
      `INSERT INTO echoverse_guild_members (guild_id,account_id,role) VALUES
       ('guild-db','owner','owner'),('guild-db','member','member')`
    );
    await database.query(
      `INSERT INTO echoverse_guild_channels (id,guild_id,name,channel_type) VALUES
       ('guild-db:general','guild-db','general','text')`
    );
    await database.query(
      `INSERT INTO echoverse_guild_messages (id,guild_id,channel_id,sender_id,body) VALUES
       ('message-db','guild-db','guild-db:general','owner','hello')`
    );
    const service = createGuildNotificationService({
      pool: database,
      memoryState: new Map(),
      memoryMessages: []
    });

    expect(await service.getUnreadCount("member", "guild-db", "guild-db:general")).toBe(1);
    await service.setLevel("member", "guild-db", "guild-db:general", "none");
    expect(await service.getUnreadCount("member", "guild-db", "guild-db:general")).toBe(0);
    await service.setLevel("member", "guild-db", "guild-db:general", "all");
    await service.markRead("member", "guild-db", "guild-db:general");
    expect(await service.getUnreadCount("member", "guild-db", "guild-db:general")).toBe(0);
    database.close();
  });
});
