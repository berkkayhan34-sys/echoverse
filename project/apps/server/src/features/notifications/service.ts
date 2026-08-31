/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  GuildNotificationLevel,
  GuildNotificationState,
  GuildNotificationPreference,
  GuildUnreadChannel
} from "@echoverse/contracts";
import type { StoredGuildMessage } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";

export type MemoryGuildChannelUserState = {
  notificationLevel: GuildNotificationLevel;
  lastReadAt: string | null;
};

type NotificationServiceDependencies = {
  pool: PersistenceDatabase | null;
  memoryState: Map<string, MemoryGuildChannelUserState>;
  memoryMessages: StoredGuildMessage[];
};

function stateKey(accountId: string, guildId: string, channelId: string) {
  return `${accountId}:${guildId}:${channelId}`;
}

function defaultState(guildId: string, channelIds: string[]): GuildNotificationState {
  return {
    guildId,
    preferences: channelIds.map((channelId) => ({ channelId, level: "all" })),
    unread: channelIds.map((channelId) => ({ channelId, unreadCount: 0 }))
  };
}

function normalizeLevel(value: unknown): GuildNotificationLevel {
  return value === "none" ? "none" : "all";
}

export function createGuildNotificationService({
  pool,
  memoryState,
  memoryMessages
}: NotificationServiceDependencies) {
  async function getLevel(accountId: string, guildId: string, channelId: string) {
    if (!pool)
      return memoryState.get(stateKey(accountId, guildId, channelId))?.notificationLevel || "all";
    const result = await pool.query(
      `SELECT notification_level FROM echoverse_guild_channel_user_state
       WHERE account_id=$1 AND guild_id=$2 AND channel_id=$3 LIMIT 1`,
      [accountId, guildId, channelId]
    );
    return normalizeLevel(result.rows[0]?.notification_level);
  }

  async function setLevel(
    accountId: string,
    guildId: string,
    channelId: string,
    level: GuildNotificationLevel
  ) {
    const key = stateKey(accountId, guildId, channelId);
    const current = memoryState.get(key);
    if (!pool) {
      memoryState.set(key, { notificationLevel: level, lastReadAt: current?.lastReadAt || null });
      return;
    }
    await pool.query(
      `INSERT INTO echoverse_guild_channel_user_state
         (guild_id,channel_id,account_id,notification_level,last_read_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
       ON CONFLICT (guild_id,channel_id,account_id)
       DO UPDATE SET notification_level=$4, updated_at=CURRENT_TIMESTAMP`,
      [guildId, channelId, accountId, level, current?.lastReadAt || null]
    );
    memoryState.set(key, { notificationLevel: level, lastReadAt: current?.lastReadAt || null });
  }

  async function markRead(accountId: string, guildId: string, channelId: string) {
    const readAt = new Date().toISOString();
    const key = stateKey(accountId, guildId, channelId);
    const current = memoryState.get(key);
    const lastReadAt =
      current?.lastReadAt && current.lastReadAt > readAt ? current.lastReadAt : readAt;
    if (!pool) {
      memoryState.set(key, {
        notificationLevel: current?.notificationLevel || "all",
        lastReadAt
      });
      return;
    }
    await pool.query(
      `INSERT INTO echoverse_guild_channel_user_state
         (guild_id,channel_id,account_id,notification_level,last_read_at,updated_at)
       VALUES ($1,$2,$3,'all',$4,CURRENT_TIMESTAMP)
       ON CONFLICT (guild_id,channel_id,account_id)
       DO UPDATE SET
         last_read_at=CASE
           WHEN echoverse_guild_channel_user_state.last_read_at IS NULL
             OR echoverse_guild_channel_user_state.last_read_at < $4
           THEN $4
           ELSE echoverse_guild_channel_user_state.last_read_at
         END,
         updated_at=CURRENT_TIMESTAMP`,
      [guildId, channelId, accountId, lastReadAt]
    );
    memoryState.set(key, {
      notificationLevel: current?.notificationLevel || "all",
      lastReadAt
    });
  }

  async function getUnreadCount(accountId: string, guildId: string, channelId: string) {
    const level = await getLevel(accountId, guildId, channelId);
    if (level === "none") return 0;
    if (!pool) {
      const lastReadAt = memoryState.get(stateKey(accountId, guildId, channelId))?.lastReadAt;
      return memoryMessages.filter(
        (message) =>
          message.guildId === guildId &&
          message.channelId === channelId &&
          message.senderId !== accountId &&
          !message.deletedAt &&
          (!lastReadAt || message.createdAt > lastReadAt)
      ).length;
    }
    const result = await pool.query(
      `SELECT COUNT(m.id) AS unread_count
       FROM echoverse_guild_messages m
       LEFT JOIN echoverse_guild_channel_user_state s
         ON s.guild_id=m.guild_id AND s.channel_id=m.channel_id AND s.account_id=$1
       WHERE m.guild_id=$2 AND m.channel_id=$3 AND m.sender_id<>$1
         AND m.deleted_at IS NULL
         AND (s.last_read_at IS NULL OR m.created_at>s.last_read_at)`,
      [accountId, guildId, channelId]
    );
    return Math.max(0, Number(result.rows[0]?.unread_count || 0));
  }

  async function getState(accountId: string, guildId: string, channelIds: string[]) {
    const ids = [...new Set(channelIds)].filter(Boolean);
    if (!pool) {
      const state = defaultState(guildId, ids);
      const preferences = state.preferences.map((preference) => {
        const saved = memoryState.get(stateKey(accountId, guildId, preference.channelId));
        return { ...preference, level: saved?.notificationLevel || "all" };
      });
      const unread = state.unread.map((item) => ({
        ...item,
        unreadCount:
          preferences.find((preference) => preference.channelId === item.channelId)?.level ===
          "none"
            ? 0
            : memoryMessages.filter((message) => {
                const saved = memoryState.get(stateKey(accountId, guildId, item.channelId));
                return (
                  message.guildId === guildId &&
                  message.channelId === item.channelId &&
                  message.senderId !== accountId &&
                  !message.deletedAt &&
                  (!saved?.lastReadAt || message.createdAt > saved.lastReadAt)
                );
              }).length
      }));
      return { guildId, preferences, unread } satisfies GuildNotificationState;
    }
    if (ids.length === 0) return defaultState(guildId, []);
    const placeholders = ids.map((_, index) => `$${index + 3}`).join(",");
    const result = await pool.query(
      `SELECT c.id AS channel_id,
              COALESCE(s.notification_level,'all') AS notification_level,
              CASE WHEN COALESCE(s.notification_level,'all')='none' THEN 0 ELSE COUNT(m.id) END AS unread_count
       FROM echoverse_guild_channels c
       LEFT JOIN echoverse_guild_channel_user_state s
         ON s.guild_id=c.guild_id AND s.channel_id=c.id AND s.account_id=$1
       LEFT JOIN echoverse_guild_messages m
         ON m.guild_id=c.guild_id AND m.channel_id=c.id AND m.sender_id<>$1
         AND m.deleted_at IS NULL
         AND (s.last_read_at IS NULL OR m.created_at>s.last_read_at)
       WHERE c.guild_id=$2 AND c.id IN (${placeholders})
       GROUP BY c.id,s.notification_level
       ORDER BY c.id`,
      [accountId, guildId, ...ids]
    );
    const rows = new Map(result.rows.map((row) => [String(row.channel_id), row]));
    const preferences: GuildNotificationPreference[] = ids.map((channelId) => ({
      channelId,
      level: normalizeLevel(rows.get(channelId)?.notification_level)
    }));
    const unread: GuildUnreadChannel[] = ids.map((channelId) => ({
      channelId,
      unreadCount: Math.max(0, Number(rows.get(channelId)?.unread_count || 0))
    }));
    return { guildId, preferences, unread } satisfies GuildNotificationState;
  }

  return { getLevel, setLevel, markRead, getUnreadCount, getState };
}
