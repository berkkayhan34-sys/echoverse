/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowSocketEvent,
  clearSocketLimits,
  MAX_SOCKET_PACKET_BYTES,
  socketEventLimit,
  socketPayloadWithinLimit
} from "./limits.js";

describe("socket event rate limits", () => {
  afterEach(() => {
    clearSocketLimits("test-socket");
    vi.useRealTimers();
  });

  it("denies events after the limit and resets the bucket after its window", () => {
    vi.useFakeTimers();

    expect(allowSocketEvent("test-socket", "auth", 2, 60_000)).toBe(true);
    expect(allowSocketEvent("test-socket", "auth", 2, 60_000)).toBe(true);
    expect(allowSocketEvent("test-socket", "auth", 2, 60_000)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(allowSocketEvent("test-socket", "auth", 2, 60_000)).toBe(true);
  });

  it("keeps limits isolated by event name", () => {
    expect(allowSocketEvent("test-socket", "auth", 1)).toBe(true);
    expect(allowSocketEvent("test-socket", "auth", 1)).toBe(false);
    expect(allowSocketEvent("test-socket", "presence", 1)).toBe(true);
  });

  it("bounds serialized socket packets and assigns limits to unclassified events", () => {
    expect(socketPayloadWithinLimit({ value: "x" })).toBe(true);
    expect(socketPayloadWithinLimit({ value: "x".repeat(MAX_SOCKET_PACKET_BYTES) })).toBe(false);
    expect(socketEventLimit("chat-message")).toBe(120);
    expect(socketEventLimit("unknown-event")).toBe(120);
  });
});
