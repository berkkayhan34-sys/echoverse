/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it, vi } from "vitest";
import { registerGuildNotificationHandlers } from "./handlers.js";

function setup() {
  const handlers = new Map<string, (payload: any, callback?: (value: any) => void) => unknown>();
  const socket = { id: "socket-1", data: { account: { id: "account-1" } } };
  const emitToAccount = vi.fn();
  const notificationService = {
    getState: vi.fn().mockResolvedValue({
      guildId: "guild-1",
      preferences: [{ channelId: "guild-1:general", level: "all" }],
      unread: [{ channelId: "guild-1:general", unreadCount: 2 }]
    }),
    setLevel: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined)
  };
  registerGuildNotificationHandlers({
    socket,
    users: new Map([
      [
        socket.id,
        {
          socketId: socket.id,
          userId: "account-1",
          accountId: "account-1",
          username: "Test",
          avatarData: null
        }
      ]
    ]),
    notificationService,
    isMember: () => true,
    listChannels: () => [
      {
        id: "guild-1:general",
        guildId: "guild-1",
        name: "general",
        type: "text",
        categoryId: null,
        position: 0,
        archived: false,
        createdAt: ""
      },
      {
        id: "guild-1:hidden",
        guildId: "guild-1",
        name: "hidden",
        type: "text",
        categoryId: null,
        position: 1,
        archived: false,
        createdAt: ""
      }
    ],
    hasScopedPermission: (_guildId, _accountId, _permission, channelId) =>
      channelId !== "guild-1:hidden",
    emitToAccount,
    socketError: () => "not allowed",
    onValidatedSocketEvent: (_socket, event, handler) => handlers.set(event, handler)
  });
  return { handlers, notificationService, emitToAccount };
}

describe("guild notification authorization", () => {
  it("does not reveal hidden channels when changing a preference", async () => {
    const { handlers, notificationService, emitToAccount } = setup();
    const callback = vi.fn();
    await handlers.get("guild:set-notification-preference")?.(
      { guildId: "guild-1", channelId: "guild-1:hidden", level: "none" },
      callback
    );
    expect(notificationService.setLevel).not.toHaveBeenCalled();
    expect(emitToAccount).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ ok: false, error: "not allowed" });
  });

  it("reconciles a changed preference to every socket for the account", async () => {
    const { handlers, notificationService, emitToAccount } = setup();
    const callback = vi.fn();
    await handlers.get("guild:set-notification-preference")?.(
      { guildId: "guild-1", channelId: "guild-1:general", level: "none" },
      callback
    );
    expect(notificationService.setLevel).toHaveBeenCalledWith(
      "account-1",
      "guild-1",
      "guild-1:general",
      "none"
    );
    expect(emitToAccount).toHaveBeenCalledWith(
      "account-1",
      "guild:notification-state",
      expect.objectContaining({ guildId: "guild-1" })
    );
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
