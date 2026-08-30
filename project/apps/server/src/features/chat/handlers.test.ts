/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it, vi } from "vitest";
import { registerChatHandlers } from "./handlers.js";

describe("chat handler persistence boundary", () => {
  it("acknowledges persistence failures without rejecting the socket handler", async () => {
    let chatHandler: ((payload: unknown, callback: (response: unknown) => void) => unknown) | null =
      null;
    const socket = { id: "socket-1", data: { locale: "en" } };
    const store = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const users = new Map([
      [
        socket.id,
        {
          socketId: socket.id,
          userId: "account-1",
          accountId: "account-1",
          username: "Test",
          avatarData: null,
          activeGuildId: "echoverse"
        }
      ]
    ]);

    registerChatHandlers({
      socket,
      io: { to: vi.fn() },
      users,
      guildChat: { store } as any,
      isMember: () => true,
      membersFor: async () => [],
      listChannels: () => [{ id: "echoverse:general", categoryId: null }],
      hasScopedPermission: () => true,
      socketError: () => "message send failed",
      accountById: vi.fn(),
      resolveRequestLocale: () => "en",
      onValidatedSocketEvent: (_socket, event, handler) => {
        if (event === "chat-message") chatHandler = handler;
      }
    });

    const callback = vi.fn();
    expect(chatHandler).toBeDefined();
    await chatHandler!(
      { guildId: "echoverse", channelId: "echoverse:general", text: "hello" },
      callback
    );

    expect(store).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ ok: false, error: "message send failed" });
  });

  it("delivers mentions only to visible guild members", async () => {
    let chatHandler: ((payload: unknown, callback: (response: unknown) => void) => unknown) | null =
      null;
    const socket = { id: "socket-owner", data: { locale: "en" } };
    const targetPeer = { id: "socket-target", emit: vi.fn() };
    const outsiderPeer = { id: "socket-outsider", emit: vi.fn() };
    const users = new Map([
      [
        socket.id,
        {
          socketId: socket.id,
          userId: "account-owner",
          accountId: "account-owner",
          username: "Owner",
          avatarData: null,
          activeGuildId: "echoverse"
        }
      ],
      [
        targetPeer.id,
        {
          socketId: targetPeer.id,
          userId: "account-target",
          accountId: "account-target",
          username: "Target",
          avatarData: null,
          activeGuildId: "echoverse"
        }
      ],
      [
        outsiderPeer.id,
        {
          socketId: outsiderPeer.id,
          userId: "account-outsider",
          accountId: "account-outsider",
          username: "Target",
          avatarData: null,
          activeGuildId: "other-guild"
        }
      ]
    ]);
    const broadcast = { emit: vi.fn() };
    const io = {
      to: vi.fn(() => broadcast),
      sockets: {
        sockets: new Map([
          [targetPeer.id, targetPeer],
          [outsiderPeer.id, outsiderPeer]
        ])
      }
    };

    registerChatHandlers({
      socket,
      io,
      users,
      guildChat: {
        store: vi.fn().mockResolvedValue({ id: "message-1", replyToId: null, createdAt: "now" })
      } as any,
      isMember: () => true,
      membersFor: async () => [
        { accountId: "account-target", username: "Target", avatarData: null }
      ],
      listChannels: () => [{ id: "echoverse:general", categoryId: null }],
      hasScopedPermission: () => true,
      socketError: () => "message send failed",
      accountById: vi.fn(),
      resolveRequestLocale: () => "en",
      onValidatedSocketEvent: (_socket, event, handler) => {
        if (event === "chat-message") chatHandler = handler;
      }
    });

    const callback = vi.fn();
    await chatHandler!(
      { guildId: "echoverse", channelId: "echoverse:general", text: "Hello @target" },
      callback
    );

    expect(broadcast.emit).toHaveBeenCalledWith("chat-message", expect.anything());
    expect(targetPeer.emit).toHaveBeenCalledWith(
      "chat:mention",
      expect.objectContaining({ messageId: "message-1", text: "Hello @target" })
    );
    expect(outsiderPeer.emit).not.toHaveBeenCalled();
  });
});
