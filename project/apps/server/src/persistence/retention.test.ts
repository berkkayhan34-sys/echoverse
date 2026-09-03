/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import type { StoredDm, StoredDmReport } from "../domain/types.js";
import {
  createRetentionService,
  RETENTION_DAYS,
  type RetentionCleanupResult
} from "./retention.js";

const dayMs = 86_400_000;

function dmMessage(id: string, deletedAt: string | null): StoredDm {
  return {
    id,
    senderId: "sender",
    recipientId: "recipient",
    conversationId: null,
    body: deletedAt ? "" : "active",
    createdAt: new Date(0).toISOString(),
    deletedAt,
    attachmentName: null,
    attachmentMime: null,
    attachmentData: null,
    reactions: {}
  };
}

function report(id: string, createdAt: string): StoredDmReport {
  return {
    id,
    reporterId: "sender",
    targetId: "recipient",
    messageId: null,
    reason: "spam",
    status: "open",
    createdAt
  };
}

describe("retention cleanup", () => {
  it("removes expired tombstones, reports, and in-memory audit events only", async () => {
    const now = Date.parse("2026-09-02T00:00:00.000Z");
    const old = new Date(now - (RETENTION_DAYS + 1) * dayMs).toISOString();
    const recent = new Date(now - (RETENTION_DAYS - 1) * dayMs).toISOString();
    const messages = [
      dmMessage("old", old),
      dmMessage("recent", recent),
      dmMessage("active", null)
    ];
    const reports = new Map([
      ["old", report("old", old)],
      ["recent", report("recent", recent)]
    ]);
    const audits = new Map([["guild", [{ createdAt: old }, { createdAt: recent }]]]);
    const service = createRetentionService({
      pool: null,
      memoryDmMessages: messages,
      memoryDmReports: reports,
      guildAuditEvents: audits
    });

    const result: RetentionCleanupResult = await service.purgeExpiredData(now);

    expect(result).toMatchObject({
      dmReports: 1,
      guildReports: 0,
      guildAuditEvents: 1,
      dmMessages: 1,
      guildMessages: 0
    });
    expect(messages.map((message) => message.id)).toEqual(["recent", "active"]);
    expect([...reports.keys()]).toEqual(["recent"]);
    expect(audits.get("guild")).toEqual([{ createdAt: recent }]);
  });
});
