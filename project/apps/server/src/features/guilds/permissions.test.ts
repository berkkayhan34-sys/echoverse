/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { canChangeRole, roleCan, roleRankOf } from "./permissions.js";

describe("guild permission evaluator", () => {
  it("is deny-by-default and grants only role-owned permissions", () => {
    expect(roleCan(undefined, "guild:view")).toBe(false);
    expect(roleCan("member", "guild:moderate")).toBe(false);
    expect(roleCan("moderator", "guild:moderate")).toBe(true);
    expect(roleCan("admin", "channel:manage")).toBe(true);
  });

  it("prevents equal or higher roles from being changed", () => {
    expect(roleRankOf("owner")).toBeGreaterThan(roleRankOf("admin"));
    expect(canChangeRole("admin", "moderator")).toBe(true);
    expect(canChangeRole("admin", "admin")).toBe(false);
    expect(canChangeRole("admin", "owner")).toBe(false);
  });
});
