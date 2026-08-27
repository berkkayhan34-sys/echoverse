/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { utilityBotResponse } from "./commands.js";

describe("utility chat commands", () => {
  it("handles deterministic commands", () => {
    expect(utilityBotResponse("!ping")).toBe("Pong 🏓");
    expect(utilityBotResponse("!help")).toContain("!roll");
    expect(utilityBotResponse("!help", "en")).toBe("Commands: !ping, !roll, !help");
    expect(utilityBotResponse("hello")).toBeNull();
  });
});
