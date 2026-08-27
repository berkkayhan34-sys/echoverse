/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { SessionManager, parseCookies, serializeCookie } from "./session.js";

describe("session manager", () => {
  it("issues short-lived access credentials and rotates refresh credentials", () => {
    let now = 1_000_000;
    const manager = new SessionManager({
      jwtSecret: "s".repeat(32),
      accessTtlSeconds: 60,
      refreshTtlSeconds: 3600,
      now: () => now
    });

    const first = manager.issue("account-1");
    expect(manager.verifyAccess(first.accessToken)).toMatchObject({ userId: "account-1" });
    const second = manager.rotate(first.refreshToken);

    expect(second).not.toBeNull();
    expect(second?.refreshToken).not.toBe(first.refreshToken);
    expect(manager.verifyAccess(first.accessToken)).toBeNull();
    expect(manager.verifyAccess(second!.accessToken)).toMatchObject({ userId: "account-1" });
    expect(manager.rotate(first.refreshToken)).toBeNull();
    expect(manager.verifyAccess(second!.accessToken)).toBeNull();

    now += 61_000;
    expect(manager.verifyAccess(second!.accessToken)).toBeNull();
  });

  it("rejects expired refresh credentials and supports explicit revocation", () => {
    let now = 10_000;
    const manager = new SessionManager({
      jwtSecret: "s".repeat(32),
      accessTtlSeconds: 60,
      refreshTtlSeconds: 120,
      now: () => now
    });
    const session = manager.issue("account-2");

    expect(manager.revokeRefresh(session.refreshToken)).toBe(true);
    expect(manager.verifyAccess(session.accessToken)).toBeNull();
    expect(manager.revokeRefresh(session.refreshToken)).toBe(false);

    const expired = manager.issue("account-3");
    now += 121_000;
    expect(manager.rotate(expired.refreshToken)).toBeNull();
  });
});

describe("session cookie helpers", () => {
  it("parses cookies and serializes secure HTTP-only SameSite cookies", () => {
    expect(parseCookies("a=one; echoverse_access=access%20value")).toEqual({
      a: "one",
      echoverse_access: "access value"
    });
    expect(
      serializeCookie("echoverse_access", "token", {
        maxAge: 900,
        path: "/",
        secure: true,
        sameSite: "none"
      })
    ).toContain("HttpOnly; SameSite=None; Secure");
  });
});
