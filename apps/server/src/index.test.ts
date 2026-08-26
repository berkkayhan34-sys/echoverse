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
    await new Promise<void>(resolve => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json() as { ok: boolean; protocolVersion: number };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, protocolVersion: 2 });
  });
});
