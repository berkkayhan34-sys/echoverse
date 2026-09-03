/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { StoredDm, StoredDmReport } from "../domain/types.js";
import type { PersistenceDatabase } from "./sqlite.js";

export const RETENTION_DAYS = 180;
export const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const RETENTION_MS = RETENTION_DAYS * 86_400_000;

type MemoryAuditEvent = { createdAt: string };

export type RetentionServiceDependencies = {
  pool: PersistenceDatabase | null;
  memoryDmMessages: StoredDm[];
  memoryDmReports: Map<string, StoredDmReport>;
  guildAuditEvents: Map<string, MemoryAuditEvent[]>;
};

export type RetentionCleanupResult = {
  cutoff: string;
  dmReports: number;
  guildReports: number;
  guildAuditEvents: number;
  dmMessages: number;
  guildMessages: number;
};

function isOlderThan(value: string | null | undefined, cutoffMs: number) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp < cutoffMs;
}

/**
 * Owns the bounded, idempotent retention pass for durable moderation and
 * deleted-message records. The timer is deliberately unref'd so tests and
 * short-lived CLI processes are not kept alive by background maintenance.
 */
export function createRetentionService({
  pool,
  memoryDmMessages,
  memoryDmReports,
  guildAuditEvents
}: RetentionServiceDependencies) {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function purgeExpiredData(now = Date.now()): Promise<RetentionCleanupResult> {
    const cutoffMs = now - RETENTION_MS;
    const cutoff = new Date(cutoffMs).toISOString();
    if (pool) {
      // Reports reference DM messages, so remove report rows before deleting
      // their optional message references. Independent tables can still be
      // cleaned concurrently without widening the transaction surface.
      const [dmReports, guildReports, guildAuditEventsResult] = await Promise.all([
        pool.query("DELETE FROM echoverse_dm_reports WHERE created_at < $1", [cutoff]),
        pool.query("DELETE FROM echoverse_guild_reports WHERE created_at < $1", [cutoff]),
        pool.query("DELETE FROM echoverse_guild_audit_events WHERE created_at < $1", [cutoff])
      ]);
      const [dmMessages, guildMessages] = await Promise.all([
        pool.query(
          "DELETE FROM echoverse_dm_messages WHERE deleted_at IS NOT NULL AND deleted_at < $1",
          [cutoff]
        ),
        pool.query(
          "DELETE FROM echoverse_guild_messages WHERE deleted_at IS NOT NULL AND deleted_at < $1",
          [cutoff]
        )
      ]);
      return {
        cutoff,
        dmReports: dmReports.rowCount,
        guildReports: guildReports.rowCount,
        guildAuditEvents: guildAuditEventsResult.rowCount,
        dmMessages: dmMessages.rowCount,
        guildMessages: guildMessages.rowCount
      };
    }

    const beforeDmMessages = memoryDmMessages.length;
    for (let index = memoryDmMessages.length - 1; index >= 0; index -= 1) {
      const message = memoryDmMessages[index];
      if (message.deletedAt && isOlderThan(message.deletedAt, cutoffMs)) {
        memoryDmMessages.splice(index, 1);
      }
    }

    let dmReports = 0;
    for (const [id, report] of memoryDmReports) {
      if (isOlderThan(report.createdAt, cutoffMs)) {
        memoryDmReports.delete(id);
        dmReports += 1;
      }
    }

    let auditEvents = 0;
    for (const [guildId, events] of guildAuditEvents) {
      const retained = events.filter((event) => !isOlderThan(event.createdAt, cutoffMs));
      auditEvents += events.length - retained.length;
      if (retained.length) guildAuditEvents.set(guildId, retained);
      else guildAuditEvents.delete(guildId);
    }

    return {
      cutoff,
      dmReports,
      guildReports: 0,
      guildAuditEvents: auditEvents,
      dmMessages: beforeDmMessages - memoryDmMessages.length,
      guildMessages: 0
    };
  }

  function start(onError?: (error: unknown) => void) {
    if (timer) return;
    timer = setInterval(() => {
      void purgeExpiredData().catch((error) => onError?.(error));
    }, RETENTION_INTERVAL_MS);
    timer.unref?.();
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  return { purgeExpiredData, start, stop };
}
