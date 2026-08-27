/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const buckets = new Map<string, { startedAt: number; count: number }>();

export const MAX_SOCKET_PACKET_BYTES = 8_000_000;

const defaultSocketEventLimits: Record<string, number> = {
  "call:start": 10,
  "call:answer": 30,
  "call:end": 30,
  "chat-message": 120,
  "friends:search": 60,
  "friends:list": 60,
  "presence:get": 60,
  "join-room": 30,
  "guild:create": 20,
  "guild:join-code": 30,
  "spotify:sync": 120,
  "dm:typing": 120,
  "dm:read": 60,
  "dm:react": 60
};

export function socketEventLimit(event: string) {
  return defaultSocketEventLimits[event] || 120;
}

export function socketPayloadWithinLimit(payload: unknown) {
  if (payload === undefined || payload === null) return true;
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8") <= MAX_SOCKET_PACKET_BYTES;
  } catch {
    return false;
  }
}

export function allowSocketEvent(
  socketId: string,
  event: string,
  limit: number,
  windowMs = 60_000
) {
  const now = Date.now();
  const key = `${socketId}:${event}`;
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clearSocketLimits(socketId: string) {
  for (const key of buckets.keys()) if (key.startsWith(`${socketId}:`)) buckets.delete(key);
}
