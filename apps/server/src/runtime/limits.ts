/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

const buckets = new Map<string, { startedAt: number; count: number }>();

export function allowSocketEvent(socketId: string, event: string, limit: number, windowMs = 60_000) {
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
