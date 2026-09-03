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

  it("applies author, date, and cursor filters before limiting results", async () => {
    const service = createGuildChatService(null, []);
    const first = await service.store({
      guildId: "g",
      channelId: "g:general",
      senderId: "alice",
      body: "release note",
      replyToId: null
    });
    const second = await service.store({
      guildId: "g",
      channelId: "g:general",
      senderId: "bob",
      body: "release follow-up",
      replyToId: first.id
    });
    const third = await service.store({
      guildId: "g",
      channelId: "g:general",
      senderId: "alice",
      body: "release final",
      replyToId: second.id
    });
    first.createdAt = "2026-01-01T00:00:00.000Z";
    second.createdAt = "2026-01-02T00:00:00.000Z";
    third.createdAt = "2026-01-03T00:00:00.000Z";

    expect(
      (await service.search("g:general", "release", 10, { authorId: "alice" })).map(
        (message) => message.id
      )
    ).toEqual([third.id, first.id]);
    expect(
      (await service.search("g:general", "release", 10, { before: second.createdAt })).map(
        (message) => message.id
      )
    ).toEqual([first.id]);
    expect((await service.search("g:general", "release", 1)).map((message) => message.id)).toEqual([
      third.id
    ]);
  });
});
