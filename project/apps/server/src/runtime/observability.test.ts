/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  createCorrelationId,
  createLogger,
  MetricsCollector,
  redactLogFields
} from "./observability.js";

describe("privacy-safe observability", () => {
  it("accepts safe correlation IDs and replaces malformed or oversized values", () => {
    expect(createCorrelationId("request-123")).toBe("request-123");
    expect(createCorrelationId("request\n123")).toMatch(/^[0-9a-f-]{36}$/);
    expect(createCorrelationId("x".repeat(65))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("redacts secrets, private content, and reversible identity values", () => {
    const redacted = redactLogFields({
      password: "password-value",
      accessToken: "access-token-value",
      authorization: "Bearer token-value",
      messageBody: "private message",
      mediaBytes: "private media",
      accountId: "account-1",
      email: "person@example.test",
      nested: { refreshToken: "refresh-token-value", safe: "kept" }
    });

    expect(JSON.stringify(redacted)).not.toContain("password-value");
    expect(JSON.stringify(redacted)).not.toContain("access-token-value");
    expect(JSON.stringify(redacted)).not.toContain("private message");
    expect(redacted).toMatchObject({
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      authorization: "[REDACTED]",
      messageBody: "[OMITTED]",
      mediaBytes: "[OMITTED]",
      accountId: "[OMITTED]",
      email: "[OMITTED]",
      nested: { refreshToken: "[REDACTED]", safe: "kept" }
    });
  });

  it("emits machine-readable records without retaining correlation IDs as user data", () => {
    const records: unknown[] = [];
    const logger = createLogger((record) => records.push(record));

    logger.info("echoverse.test.event", { correlationId: "request-123", status: 200 });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      service: "echoverse-server",
      level: "info",
      event: "echoverse.test.event",
      correlationId: "request-123",
      fields: { status: 200 }
    });
  });

  it("keeps bounded process-local counters and timings", () => {
    const metrics = new MetricsCollector();
    metrics.increment("http.requests.started");
    metrics.increment("http.requests.started", 2);
    metrics.observe("http.request_duration_ms", 12.5);
    metrics.observe("http.request_duration_ms", 7.5);
    metrics.increment("invalid name", 100);
    for (let index = 0; index < 65; index += 1) metrics.increment(`bounded.${index}`);

    const snapshot = metrics.snapshot();
    expect(snapshot).toMatchObject({
      counters: { "http.requests.started": 3 },
      timings: {
        "http.request_duration_ms": { count: 2, totalMs: 20, maxMs: 12.5 }
      }
    });
    expect(Object.keys(snapshot.counters)).toHaveLength(64);
  });
});
