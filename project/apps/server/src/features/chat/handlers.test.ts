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
});
