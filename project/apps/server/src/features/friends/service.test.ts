/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { createFriendService } from "./service.js";

function createMemoryService() {
  const memoryDmMessages: any[] = [];
  return {
    messages: memoryDmMessages,
    service: createFriendService({
      pool: null,
      sqliteDatabase: null,
      memoryAccounts: new Map(),
      memoryFriendships: new Map(),
      memoryDmMessages,
      memoryDmRequests: new Map(),
      memoryDmPeerPreferences: new Map(),
      memoryDmPrivacy: new Map(),
      memoryDmReports: new Map(),
      memoryDmConversations: new Map(),
      publicUserById: async () => null
    })
  };
}

describe("direct-message search boundary", () => {
  it("scopes direct and group searches and applies cursors", async () => {
    const { service } = createMemoryService();
    const first = await service.storeDm("alice", "bob", "release note");
    const second = await service.storeDm("bob", "alice", "release follow-up");
    first.createdAt = "2026-01-01T00:00:00.000Z";
    second.createdAt = "2026-01-02T00:00:00.000Z";

    expect(
      (await service.searchDm("alice", { friendId: "bob" }, "release")).map((m) => m.id)
    ).toEqual([second.id, first.id]);
    expect(
      (
        await service.searchDm("alice", { friendId: "bob" }, "release", 10, { authorId: "alice" })
      ).map((m) => m.id)
    ).toEqual([first.id]);
    expect(
      (
        await service.searchDm("alice", { friendId: "bob" }, "release", 10, {
          before: second.createdAt
        })
      ).map((m) => m.id)
    ).toEqual([first.id]);

    const group = await service.createGroupConversation("alice", ["bob"]);
    const groupMessage = await service.storeDm("bob", group.id, "release in group", {
      conversationId: group.id
    });
    expect(
      (await service.searchDm("alice", { conversationId: group.id }, "release")).map((m) => m.id)
    ).toEqual([groupMessage.id]);
    groupMessage.deletedAt = new Date().toISOString();
    expect(await service.searchDm("alice", { conversationId: group.id }, "release")).toEqual([]);
  });
});

describe("direct-message report intake", () => {
  it("is replay-safe and rate-limits each reporter", async () => {
    const { service } = createMemoryService();
    const first = await service.createDmReport("alice", "bob", null, "unwanted contact");
    expect(first).toMatchObject({ created: true, report: { reporterId: "alice", targetId: "bob" } });

    const replay = await service.createDmReport("alice", "bob", null, "different reason");
    expect(replay).toEqual({ created: false, report: first?.report });

    for (let index = 0; index < 9; index += 1) {
      const result = await service.createDmReport("alice", `target-${index}`, `message-${index}`, "spam");
      expect(result?.created).toBe(true);
    }
    expect(await service.createDmReport("alice", "one-more", "message-more", "spam")).toBeNull();
  });
});
