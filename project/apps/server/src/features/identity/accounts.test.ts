/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import type { Account } from "../../domain/types.js";
import { createAccountService } from "./accounts.js";

describe("identity account service", () => {
  it("creates, looks up, and updates memory-backed accounts", async () => {
    const memoryAccounts = new Map<string, Account>();
    const service = createAccountService({ pool: null, memoryAccounts });

    const account = await service.createAccount("user@example.test", "User", "hash");

    expect(await service.accountById(account.id)).toEqual(account);
    expect(await service.accountByEmail(account.email)).toEqual(account);
    expect(await service.usernameExists("user")).toBe(true);
    expect(service.publicAccount(account)).toEqual({
      id: account.id,
      email: account.email,
      username: account.username,
      avatarData: null
    });

    await service.updateAvatar(account.id, "data:image/png;base64,AAAA");
    expect((await service.accountById(account.id))?.avatarData).toBe("data:image/png;base64,AAAA");
  });

  it("does not expose an unknown account as a public user", async () => {
    const service = createAccountService({ pool: null, memoryAccounts: new Map() });

    expect(await service.publicUserById("missing")).toBeNull();
  });
});
