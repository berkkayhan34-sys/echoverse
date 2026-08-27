/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import type { DmMessage, FriendUser } from "@echoverse/contracts";
import { createDirectMessagesFeature } from "./direct-messages";

describe("desktop direct-message feature", () => {
  it("keeps the reply target while clearing the composer", () => {
    const events: Array<{ name: string; payload: unknown }> = [];
    const socket = {
      emit(name: string, payload: unknown) {
        events.push({ name, payload });
      }
    } as unknown as Socket;
    const friend: FriendUser = { id: "friend-1", username: "Ada" };
    const reply: DmMessage = {
      id: "message-1",
      senderId: "friend-1",
      recipientId: "account-1",
      body: "Earlier message",
      createdAt: "2026-08-28T00:00:00.000Z"
    };
    let text = "  A reply  ";
    let currentReply: DmMessage | null = reply;
    let attachment: { name: string; mime: string; data: string } | null = null;

    const feature = createDirectMessagesFeature({
      getSocket: () => socket,
      getFriend: () => friend,
      getAccount: () => ({ id: "account-1", email: "owner@example.test", username: "Owner" }),
      getText: () => text,
      getEditing: () => null,
      getAttachment: () => attachment,
      getReply: () => currentReply,
      getTypingTimer: () => null,
      setTypingTimer: () => {},
      setText: (value) => {
        text = value;
      },
      setAttachment: (value) => {
        attachment = value;
      },
      setReply: (value) => {
        currentReply = value;
      },
      setEditing: () => {},
      setError: () => {},
      translate: (key) => key,
      confirmDelete: () => true
    });

    feature.sendDm();

    expect(text).toBe("");
    expect(currentReply).toBeNull();
    expect(events.at(-1)).toEqual({
      name: "dm:send",
      payload: {
        friendId: "friend-1",
        body: "A reply",
        replyToId: "message-1",
        attachment: null
      }
    });
  });
});
