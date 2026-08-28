/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";

const correlationIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const sensitiveKeyPattern = /(password|token|cookie|authorization|secret|credential|oauth|code)/i;
const privateContentKeyPattern = /(body|message|media|attachment|avatar|payload)/i;
const identifierKeyPattern = /(user|account|socket|session)(id|_id)?/i;
const personalKeyPattern = /(email|username|displayname|ip|address)/i;

type LogLevel = "info" | "warn" | "error";
type LogValue = string | number | boolean | null | LogValue[] | { [key: string]: LogValue };
export type LogFields = Record<string, unknown>;

export type LogRecord = {
  timestamp: string;
  service: "echoverse-server";
  level: LogLevel;
  event: string;
  correlationId?: string;
  fields?: Record<string, LogValue>;
};

export type LogSink = (record: LogRecord) => void;

function safeEvent(event: string) {
  return /^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(event) ? event : "echoverse.invalid_event";
}

function redactValue(key: string, value: unknown, seen: WeakSet<object>): LogValue {
  if (sensitiveKeyPattern.test(key)) return "[REDACTED]";
  if (privateContentKeyPattern.test(key)) return "[OMITTED]";
  if (identifierKeyPattern.test(key)) return "[OMITTED]";
  if (personalKeyPattern.test(key)) return "[OMITTED]";
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : "[OMITTED]";
  if (typeof value !== "object") return "[OMITTED]";
  if (seen.has(value)) return "[OMITTED]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 32).map((item) => redactValue(key, item, seen));
  }

  const result: Record<string, LogValue> = {};
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    result[nestedKey] = redactValue(nestedKey, nestedValue, seen);
  }
  return result;
}

/** Redacts secrets, private content, and reversible identity data before serialization. */
export function redactLogFields(fields: LogFields = {}) {
  const seen = new WeakSet<object>();
  const result: Record<string, LogValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = redactValue(key, value, seen);
  }
  return result;
}

/** Accepts a safe caller-supplied correlation ID or creates an opaque replacement. */
export function createCorrelationId(value: unknown) {
  return typeof value === "string" && correlationIdPattern.test(value)
    ? value
    : crypto.randomUUID();
}

export function createLogger(
  sink: LogSink = (record) => {
    const writer =
      record.level === "error"
        ? console.error
        : record.level === "warn"
          ? console.warn
          : console.log;
    writer(JSON.stringify(record));
  }
) {
  function write(level: LogLevel, event: string, fields: LogFields = {}) {
    const correlationId =
      typeof fields.correlationId === "string" ? fields.correlationId : undefined;
    const { correlationId: _ignoredCorrelationId, ...otherFields } = fields;
    sink({
      timestamp: new Date().toISOString(),
      service: "echoverse-server",
      level,
      event: safeEvent(event),
      ...(correlationId ? { correlationId: createCorrelationId(correlationId) } : {}),
      fields: redactLogFields(otherFields)
    });
  }

  return {
    info: (event: string, fields?: LogFields) => write("info", event, fields),
    warn: (event: string, fields?: LogFields) => write("warn", event, fields),
    error: (event: string, fields?: LogFields) => write("error", event, fields)
  };
}

type Timing = { count: number; totalMs: number; maxMs: number };

export type MetricsSnapshot = {
  counters: Record<string, number>;
  timings: Record<string, Timing>;
};

/** Keeps small, process-local operational metrics without retaining request data. */
export class MetricsCollector {
  private readonly counters = new Map<string, number>();
  private readonly timings = new Map<string, Timing>();

  increment(name: string, amount = 1) {
    if (!/^[a-z0-9_.:-]{1,96}$/.test(name) || !Number.isSafeInteger(amount) || amount < 0) return;
    if (!this.counters.has(name) && this.counters.size >= 64) return;
    this.counters.set(name, (this.counters.get(name) || 0) + amount);
  }

  observe(name: string, durationMs: number) {
    if (!/^[a-z0-9_.:-]{1,96}$/.test(name) || !Number.isFinite(durationMs) || durationMs < 0)
      return;
    if (!this.timings.has(name) && this.timings.size >= 64) return;
    const current = this.timings.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
    this.timings.set(name, {
      count: current.count + 1,
      totalMs: current.totalMs + durationMs,
      maxMs: Math.max(current.maxMs, durationMs)
    });
  }

  snapshot(): MetricsSnapshot {
    return {
      counters: Object.fromEntries(
        [...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b))
      ),
      timings: Object.fromEntries(
        [...this.timings.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => [name, { ...value }])
      )
    };
  }

  reset() {
    this.counters.clear();
    this.timings.clear();
  }
}

export const serverLogger = createLogger();
export const serverMetrics = new MetricsCollector();
