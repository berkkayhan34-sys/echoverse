/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it, vi } from "vitest";
import type { Guild, User } from "../../domain/types.js";
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
      users,
      spotifyParties: new Map()
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
});
