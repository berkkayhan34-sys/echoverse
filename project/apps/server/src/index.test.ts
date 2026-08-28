/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterEach, describe, expect, it } from "vitest";
import { httpServer } from "./index.js";

describe("server health boundary", () => {
  afterEach(() => {
    if (httpServer.listening) httpServer.close();
  });

  it("reports product and protocol versions without starting a daemon on import", async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    await fetch(`http://127.0.0.1:${address.port}/health`);
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = (await response.json()) as {
      ok: boolean;
      protocolVersion: number;
      metrics: { counters: Record<string, number>; timings: Record<string, unknown> };
    };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, protocolVersion: 2 });
    expect(body.metrics.counters["http.requests.started"]).toBeGreaterThan(0);
    expect(body.metrics.timings).toHaveProperty("http.request_duration_ms");
    expect(response.headers.get("X-EchoVerse-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
