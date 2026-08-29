/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { createGuildChatService } from "./guild-service.js";

describe("guild chat persistence boundary", () => {
  it("stores, searches, edits, pins, and reacts without leaking other channels", async () => {
    const service = createGuildChatService(null, []);
    const message = await service.store({
      guildId: "g",
      channelId: "g:general",
      senderId: "a",
      body: "Hello Echo",
      replyToId: null
    });
    await service.store({
      guildId: "g",
      channelId: "g:other",
      senderId: "a",
      body: "Other",
      replyToId: null
    });
    expect(await service.history("g:general")).toHaveLength(1);
    expect((await service.search("g:general", "echo"))[0]?.id).toBe(message.id);
    const updated = await service.update(message.id, {
      body: "Edited",
      pinned: true,
      reactions: { "👍": ["a"] }
    });
    expect(updated).toMatchObject({ body: "Edited", pinned: true, reactions: { "👍": ["a"] } });
    expect((await service.history("g:other"))[0]?.body).toBe("Other");
  });
});
