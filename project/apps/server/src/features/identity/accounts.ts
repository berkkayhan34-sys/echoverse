/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import type { Account, PublicAccount } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";

export type AccountServiceDependencies = {
  pool: PersistenceDatabase | null;
  memoryAccounts: Map<string, Account>;
};

export function createAccountService({ pool, memoryAccounts }: AccountServiceDependencies) {
  function publicAccount(account: Account): PublicAccount {
    return {
      id: account.id,
      email: account.email,
      username: account.username,
      avatarData: account.avatarData
    };
  }

  async function accountById(id: string): Promise<Account | null> {
    if (!id) return null;

    if (!pool) return memoryAccounts.get(id) || null;

    const result = await pool.query(
      `SELECT id, email, username, password_hash, avatar_data, created_at
       FROM echoverse_users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      avatarData: row.avatar_data || null,
      createdAt: row.created_at?.toISOString?.() || String(row.created_at)
    };
  }

  async function accountByEmail(email: string): Promise<Account | null> {
    if (!pool) {
      for (const account of memoryAccounts.values()) {
        if (account.email === email) return account;
      }
      return null;
    }

    const result = await pool.query(
      `SELECT id, email, username, password_hash, avatar_data, created_at
       FROM echoverse_users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      avatarData: row.avatar_data || null,
      createdAt: row.created_at?.toISOString?.() || String(row.created_at)
    };
  }

  async function usernameExists(username: string) {
    if (!pool) {
      return [...memoryAccounts.values()].some(
        (account) => account.username.toLowerCase() === username.toLowerCase()
      );
    }

    const result = await pool.query(
      `SELECT 1 FROM echoverse_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username]
    );

    return (result.rowCount || 0) > 0;
  }

  async function createAccount(
    email: string,
    username: string,
    passwordHash: string
  ): Promise<Account> {
    const account: Account = {
      id: crypto.randomUUID(),
      email,
      username,
      passwordHash,
      avatarData: null,
      createdAt: new Date().toISOString()
    };

    if (!pool) {
      memoryAccounts.set(account.id, account);
      return account;
    }

    await pool.query(
      `INSERT INTO echoverse_users
         (id, email, username, password_hash, avatar_data)
       VALUES ($1, $2, $3, $4, NULL)`,
      [account.id, account.email, account.username, account.passwordHash]
    );

    return account;
  }

  async function updateAvatar(accountId: string, avatarData: string | null) {
    if (!pool) {
      const account = memoryAccounts.get(accountId);
      if (!account) return null;
      account.avatarData = avatarData;
      memoryAccounts.set(accountId, account);
      return account;
    }

    await pool.query(`UPDATE echoverse_users SET avatar_data = $1 WHERE id = $2`, [
      avatarData,
      accountId
    ]);

    return accountById(accountId);
  }

  async function publicUserById(id: string) {
    const account = await accountById(id);
    if (!account) return null;
    return {
      id: account.id,
      username: account.username,
      avatarData: account.avatarData
    };
  }

  return {
    accountById,
    accountByEmail,
    createAccount,
    publicAccount,
    publicUserById,
    updateAvatar,
    usernameExists
  };
}
