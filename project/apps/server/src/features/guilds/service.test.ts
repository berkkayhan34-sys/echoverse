/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it, vi } from "vitest";
import type { Account, Guild, User } from "../../domain/types.js";
import { createGuildService } from "./service.js";

describe("guild and presence service", () => {
  it("lists room members without exposing private user fields", () => {
    const guilds = new Map<string, Guild>([
      ["echoverse", { id: "echoverse", name: "EchoVerse", createdBy: "system", createdAt: "now" }]
    ]);
    const users = new Map<string, User>([
      [
        "socket-1",
        {
          socketId: "socket-1",
          userId: "account-1",
          accountId: "account-1",
          username: "Ada",
          avatarData: null,
          roomId: "guild:echoverse:lobby",
          guildId: "echoverse"
        }
      ],
      [
        "socket-2",
        {
          socketId: "socket-2",
          userId: "account-2",
          username: "Lin",
          avatarData: "data:image/png;base64,AAAA"
        }
      ]
    ]);
    const service = createGuildService({
      io: { to: vi.fn() },
      guilds,
      guildMembers: new Map(),
      users
    });

    expect(service.roomFor("echoverse")).toBe("guild:echoverse:lobby");
    expect(service.guildList()).toEqual([...guilds.values()]);
    expect(service.getPresence("guild:echoverse:lobby")).toEqual([
      {
        socketId: "socket-1",
        userId: "account-1",
        username: "Ada",
        avatarData: null
      }
    ]);
  });

  it("persists automatic membership for an existing main guild", async () => {
    const guilds = new Map<string, Guild>([
      [
        "echoverse",
        {
          id: "echoverse",
          name: "EchoVerse",
          createdBy: "owner",
          ownerId: "owner",
          createdAt: "now"
        }
      ]
    ]);
    const guildMembers = new Map<string, Set<string>>();
    const member: Account = {
      id: "member",
      email: "member@example.test",
      username: "Member",
      passwordHash: "hash",
      avatarData: null,
      createdAt: "now"
    };
    const service = createGuildService({
      io: { to: vi.fn() },
      guilds,
      guildMembers,
      users: new Map()
    });

    await service.ensureMainGuildMembership(member);

    expect(service.isMember("echoverse", "member")).toBe(true);
    expect(service.roleFor("echoverse", "member")).toBe("member");
    expect(service.guildList("member")).toEqual([{ ...guilds.get("echoverse"), role: "member" }]);
  });

  it("keeps the main guild public when membership rows are missing", async () => {
    const guilds = new Map<string, Guild>([
      ["echoverse", { id: "echoverse", name: "EchoVerse", createdBy: "system", createdAt: "now" }]
    ]);
    const service = createGuildService({
      io: { to: vi.fn() },
      guilds,
      guildMembers: new Map(),
      users: new Map()
    });

    expect(service.isMember("echoverse", "any-account")).toBe(true);
    expect(service.guildList("any-account")).toEqual([
      { ...guilds.get("echoverse"), role: "member" }
    ]);
    expect(service.guildChannels("echoverse")).toEqual([
      expect.objectContaining({ id: "echoverse:general", type: "text" }),
      expect.objectContaining({ id: "echoverse:lobby", type: "voice" })
    ]);
    expect(service.hasScopedPermission("echoverse", "any-account", "message:send")).toBe(true);
    expect(service.canManage("echoverse", "any-account")).toBe(false);
    expect(await service.leaveGuild("echoverse", "any-account")).toBe(false);
  });

  it("does not persist channels for an in-memory guild missing from the database", async () => {
    const queries: string[] = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [], rowCount: 0 };
      })
    };
    const service = createGuildService({
      io: { to: vi.fn() },
      pool,
      guilds: new Map([
        ["echoverse", { id: "echoverse", name: "EchoVerse", createdBy: "system", createdAt: "now" }]
      ]),
      guildMembers: new Map(),
      users: new Map()
    });

    await service.loadGuilds();

    expect(queries.some((sql) => sql.startsWith("INSERT INTO echoverse_guild_channels"))).toBe(
      false
    );
  });

  it("creates categories and enforces report budgets in memory", async () => {
    const guilds = new Map<string, Guild>([
      [
        "guild",
        { id: "guild", name: "Guild", createdBy: "owner", ownerId: "owner", createdAt: "now" }
      ]
    ]);
    const guildMembers = new Map([["guild", new Set(["owner", "member"])]]);
    const guildRoles = new Map([
      [
        "guild",
        new Map([
          ["owner", "owner" as const],
          ["member", "member" as const]
        ])
      ]
    ]);
    const service = createGuildService({
      io: { to: vi.fn() },
      guilds,
      guildMembers,
      guildRoles,
      users: new Map()
    });
    const category = await service.createCategory("guild", "General");
    expect(service.guildCategories("guild")).toEqual([category]);
    for (let i = 0; i < 10; i++)
      expect(await service.reportMember("guild", "member", "owner", `reason-${i}`)).not.toBeNull();
    expect(await service.reportMember("guild", "member", "owner", "blocked")).toBeNull();
  });

  it("applies category permission denies to channel-scoped checks", async () => {
    const guilds = new Map<string, Guild>([
      [
        "guild",
        { id: "guild", name: "Guild", createdBy: "owner", ownerId: "owner", createdAt: "now" }
      ]
    ]);
    const guildMembers = new Map([["guild", new Set(["owner", "member"])]]);
    const guildRoles = new Map([
      [
        "guild",
        new Map([
          ["owner", "owner" as const],
          ["member", "member" as const]
        ])
      ]
    ]);
    const service = createGuildService({
      io: { to: vi.fn() },
      guilds,
      guildMembers,
      guildRoles,
      users: new Map()
    });
    const category = await service.createCategory("guild", "Private");
    const channel = await service.createChannel("guild", "private-chat", "text", category.id);

    expect(
      service.hasScopedPermission("guild", "member", "message:send", channel.id, category.id)
    ).toBe(true);
    await service.setPermissionOverride(
      "guild",
      "category",
      category.id,
      "member",
      "message:send",
      false
    );
    expect(
      service.hasScopedPermission("guild", "member", "message:send", channel.id, category.id)
    ).toBe(false);
  });
});
