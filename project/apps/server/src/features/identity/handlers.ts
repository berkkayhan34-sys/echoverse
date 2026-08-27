/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  authCredentialsSchema,
  graphemeLength,
  registerCredentialsSchema,
  socketEventPayloadSchemas
} from "@echoverse/contracts";
import { sanitizeEmail, sanitizeName, validEmail } from "../../domain/validation.js";
import type { Account, User } from "../../domain/types.js";
import type { SessionManager } from "../../auth/session.js";

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type IdentityHandlerDependencies = {
  socket: any;
  users: Map<string, User>;
  sessionManager: SessionManager;
  accountByEmail(email: string): Promise<Account | null>;
  accountById(id: string): Promise<Account | null>;
  createAccount(email: string, username: string, passwordHash: string): Promise<Account>;
  updateAvatar(accountId: string, avatarData: string | null): Promise<Account | null>;
  usernameExists(username: string): Promise<boolean>;
  publicAccount(account: Account): Record<string, unknown>;
  guildList(accountId?: string): unknown[];
  attachAccountToSocket(socket: any, account: Account, sessionId?: string): Record<string, unknown>;
  verifyToken(token: string): string;
  leaveCurrentRoom(socket: any, user: User): void;
  broadcastPresence(roomId: string): void;
  allowSocketEvent(socketId: string, event: string, limit: number): boolean;
  socketError(socket: any, key: string): string;
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerIdentityHandlers({
  socket,
  users,
  sessionManager,
  accountByEmail,
  accountById,
  createAccount,
  updateAvatar,
  usernameExists,
  publicAccount,
  guildList,
  attachAccountToSocket,
  verifyToken,
  leaveCurrentRoom,
  broadcastPresence,
  allowSocketEvent,
  socketError,
  onValidatedSocketEvent
}: IdentityHandlerDependencies) {
  function sessionResponse(account: Account, tokens: any) {
    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      account: publicAccount(account)
    };
  }

  onValidatedSocketEvent(socket, "auth:register", async (payload, callback) => {
    if (socket.data.client !== "desktop") {
      callback?.({ ok: false, error: socketError(socket, "server.webAuthHttpOnly") });
      return;
    }
    if (!allowSocketEvent(socket.id, "auth", 8)) {
      callback?.({ ok: false, error: socketError(socket, "server.rateLimited") });
      return;
    }
    try {
      const parsed = registerCredentialsSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ ok: false, error: socketError(socket, "server.registrationInvalid") });
        return;
      }
      const email = sanitizeEmail(parsed.data.email);
      const username = sanitizeName(parsed.data.username);
      const password = parsed.data.password;

      if (!validEmail(email)) {
        callback?.({ ok: false, error: socketError(socket, "server.emailInvalid") });
        return;
      }
      if (graphemeLength(username) < 3) {
        callback?.({ ok: false, error: socketError(socket, "server.usernameTooShort") });
        return;
      }
      if (password.length < 6) {
        callback?.({ ok: false, error: socketError(socket, "server.passwordTooShort") });
        return;
      }
      if (await accountByEmail(email)) {
        callback?.({ ok: false, error: socketError(socket, "server.emailRegistered") });
        return;
      }
      if (await usernameExists(username)) {
        callback?.({ ok: false, error: socketError(socket, "server.usernameTaken") });
        return;
      }

      const hash = await bcrypt.hash(password, 12);
      const account = await createAccount(email, username, hash);
      const tokens = sessionManager.issue(account.id);
      attachAccountToSocket(socket, account, tokens.sessionId);
      socket.data.accessToken = tokens.accessToken;
      callback?.({ ok: true, ...sessionResponse(account, tokens) });
    } catch {
      console.error("echoverse.auth.register_failed");
      callback?.({ ok: false, error: socketError(socket, "server.registrationFailed") });
    }
  });

  onValidatedSocketEvent(socket, "auth:login", async (payload, callback) => {
    if (socket.data.client !== "desktop") {
      callback?.({ ok: false, error: socketError(socket, "server.webAuthHttpOnly") });
      return;
    }
    if (!allowSocketEvent(socket.id, "auth", 8)) {
      callback?.({ ok: false, error: socketError(socket, "server.rateLimited") });
      return;
    }
    try {
      const parsed = authCredentialsSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ ok: false, error: socketError(socket, "server.invalidCredentials") });
        return;
      }
      const email = sanitizeEmail(parsed.data.email);
      const account = await accountByEmail(email);
      if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
        callback?.({ ok: false, error: socketError(socket, "server.invalidCredentials") });
        return;
      }

      const tokens = sessionManager.issue(account.id);
      attachAccountToSocket(socket, account, tokens.sessionId);
      socket.data.accessToken = tokens.accessToken;
      callback?.({ ok: true, ...sessionResponse(account, tokens) });
    } catch {
      console.error("echoverse.auth.login_failed");
      callback?.({ ok: false, error: socketError(socket, "server.loginFailed") });
    }
  });

  onValidatedSocketEvent(socket, "auth:resume", async (payload, callback) => {
    if (socket.data.client !== "desktop") {
      callback?.({ ok: false });
      return;
    }
    try {
      const token = String(payload?.token || "");
      const refreshToken = String(payload?.refreshToken || "");
      const current = refreshToken ? sessionManager.rotate(refreshToken) : null;
      const accountId = current?.sessionId
        ? sessionManager.verifyAccess(current.accessToken)?.userId || ""
        : verifyToken(token);
      const account = await accountById(accountId);
      if (!account) {
        callback?.({ ok: false });
        return;
      }

      const tokens = current || sessionManager.issue(account.id);
      attachAccountToSocket(socket, account, tokens.sessionId);
      socket.data.accessToken = tokens.accessToken;
      callback?.({ ok: true, ...sessionResponse(account, tokens) });
    } catch {
      callback?.({ ok: false });
    }
  });

  onValidatedSocketEvent(socket, "auth:logout", (payload) => {
    const token = String(payload?.token || "");
    if (socket.data.sessionId) sessionManager.revokeSession(String(socket.data.sessionId));
    if (token) sessionManager.revokeAccess(token);
    const current = users.get(socket.id);
    if (current?.roomId) leaveCurrentRoom(socket, current);
    users.delete(socket.id);
    socket.data.account = undefined;
    socket.data.sessionId = undefined;
    socket.data.accessToken = undefined;
  });

  onValidatedSocketEvent(socket, "profile:set-avatar", async (payload, callback) => {
    try {
      const accountId = socket.data.account?.id || verifyToken(String(payload?.token || ""));
      if (!accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.sessionInvalid") });
        return;
      }

      let clean: string | null = null;
      if (payload?.avatarData) {
        clean = String(payload.avatarData);
        if (!/^data:image\/(png|jpeg|webp);base64,/i.test(clean)) {
          callback?.({ ok: false, error: socketError(socket, "server.avatarInvalid") });
          return;
        }
        if (clean.length > 700_000) {
          callback?.({ ok: false, error: socketError(socket, "server.avatarTooLarge") });
          return;
        }
      }

      const account = await updateAvatar(accountId, clean);
      if (!account) {
        callback?.({ ok: false, error: socketError(socket, "server.accountNotFound") });
        return;
      }

      const user = users.get(socket.id);
      if (user) {
        user.avatarData = account.avatarData;
        users.set(socket.id, user);
        if (user.roomId) broadcastPresence(user.roomId);
      }
      callback?.({ ok: true, account: publicAccount(account) });
    } catch {
      console.error("echoverse.profile.avatar_update_failed");
      callback?.({ ok: false, error: socketError(socket, "server.avatarUpdateFailed") });
    }
  });

  onValidatedSocketEvent(socket, "identify", async ({ token, userId, username }) => {
    const accountId = verifyToken(String(token || ""));
    if (accountId) {
      const account = await accountById(accountId);
      if (account) {
        attachAccountToSocket(socket, account, socket.data.sessionId);
        socket.emit("guild:list", guildList(account.id));
        return;
      }
    }

    users.set(socket.id, {
      socketId: socket.id,
      userId: String(userId || crypto.randomUUID()),
      username: sanitizeName(username) || socketError(socket, "server.guest"),
      avatarData: null
    });
  });
}
