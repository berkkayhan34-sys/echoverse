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
      { ...guilds.get("echoverse"), role: undefined }
    ]);
    expect(await service.leaveGuild("echoverse", "any-account")).toBe(false);
  });
});
