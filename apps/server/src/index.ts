import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { loadServerConfig } from "@echoverse/config";
import {
  PROTOCOL_VERSION,
  attachmentSchema,
  authCredentialsSchema,
  chatMessageSchema,
  registerCredentialsSchema,
  socketEventPayloadSchemas,
  webrtcDescriptionSchema,
  webrtcIceCandidateSchema
} from "@echoverse/contracts";
import { runMigrations } from "./persistence/migrations.js";
import { type PersistenceDatabase, SqliteDatabase } from "./persistence/sqlite.js";
import { runSqliteMigrations } from "./persistence/sqlite-migrations.js";
import { sanitizeEmail, sanitizeName, sanitizeText, validEmail } from "./domain/validation.js";
import type {
  Account,
  Guild,
  PublicAccount,
  SpotifyPartyState,
  StoredDm,
  User
} from "./domain/types.js";
import { utilityBotResponse } from "./features/chat/commands.js";
import {
  allowSocketEvent,
  clearSocketLimits,
  MAX_SOCKET_PACKET_BYTES,
  socketEventLimit,
  socketPayloadWithinLimit
} from "./runtime/limits.js";
import {
  parseCookies,
  serializeCookie,
  SessionManager,
  type SessionTokens
} from "./auth/session.js";
import {
  accountPresence,
  dmReadAt,
  guilds,
  memoryAccounts,
  memoryDmMessages,
  memoryFriendships,
  pendingCalls,
  spotifyParties,
  users
} from "./runtime/state.js";

const { Pool } = pg;
const require = createRequire(import.meta.url);
const APP_VERSION = String(require("../package.json").version);
const config = loadServerConfig();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/", (_req, res) => {
  res.json({
    name: "EchoVerse Server",
    version: APP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    ok: true,
    database: config.databaseUrl ? "postgres" : config.sqlitePath ? "sqlite" : "memory",
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    database: config.databaseUrl ? "postgres" : config.sqlitePath ? "sqlite" : "memory"
  });
});

const httpServer = http.createServer(app);
httpServer.requestTimeout = 15_000;
httpServer.headersTimeout = 10_000;
httpServer.keepAliveTimeout = 5_000;

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigins, credentials: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 8e6
});

const sessionManager = new SessionManager({
  jwtSecret: config.jwtSecret,
  accessTtlSeconds: config.sessionAccessTtlSeconds,
  refreshTtlSeconds: config.sessionRefreshTtlSeconds
});

io.use(async (socket, next) => {
  const requested = Number(socket.handshake.auth?.protocolVersion);
  if (requested !== PROTOCOL_VERSION) {
    next(new Error(`Unsupported protocol version: ${requested}`));
    return;
  }

  const authToken = String(
    socket.handshake.auth?.accessToken ||
      parseCookies(socket.handshake.headers.cookie).echoverse_access ||
      ""
  );

  if (authToken) {
    const verified = sessionManager.verifyAccess(authToken);
    if (!verified) {
      next(new Error("Invalid session"));
      return;
    }

    const account = await accountById(verified.userId);
    if (!account) {
      next(new Error("Invalid session"));
      return;
    }

    socket.data.account = account;
    socket.data.sessionId = verified.sessionId;
    socket.data.accessToken = authToken;
  }

  socket.data.client = socket.handshake.auth?.client === "desktop" ? "desktop" : "web";

  next();
});

const postgresPool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl:
        config.nodeEnv === "production"
          ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
          : undefined
    })
  : null;

const sqliteDatabase = config.sqlitePath ? new SqliteDatabase(config.sqlitePath) : null;
const pool: PersistenceDatabase | null = postgresPool || sqliteDatabase;

guilds.set("echoverse", {
  id: "echoverse",
  name: "EchoVerse",
  createdBy: "system",
  createdAt: new Date().toISOString()
});

function publicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    avatarData: account.avatarData
  };
}

function verifyToken(token: string) {
  return sessionManager.verifyAccess(token)?.userId || "";
}

function sessionResponse(account: Account, tokens: SessionTokens) {
  return {
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    account: publicAccount(account)
  };
}

const ACCESS_COOKIE = "echoverse_access";
const REFRESH_COOKIE = "echoverse_refresh";
const authHttpRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

function onValidatedSocketEvent(
  socket: any,
  event: keyof typeof socketEventPayloadSchemas,
  handler: (payload: any, callback?: (response: unknown) => void) => unknown
) {
  const schema = socketEventPayloadSchemas[event];
  socket.on(event, (payload: unknown, callback?: (response: unknown) => void) => {
    const actualCallback =
      typeof payload === "function" ? (payload as (response: unknown) => void) : callback;
    const candidate = typeof payload === "function" ? undefined : payload;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      actualCallback?.({ ok: false, error: "Geçersiz istek." });
      return;
    }
    return handler(parsed.data, actualCallback);
  });
}

function isDesktopRequest(req: express.Request) {
  return req.get("X-EchoVerse-Client") === "desktop";
}

function setWebSessionCookies(res: express.Response, tokens: SessionTokens) {
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, tokens.accessToken, {
      maxAge: config.sessionAccessTtlSeconds,
      path: "/",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    }),
    serializeCookie(REFRESH_COOKIE, tokens.refreshToken, {
      maxAge: config.sessionRefreshTtlSeconds,
      path: "/auth",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    })
  ]);
}

function clearWebSessionCookies(res: express.Response) {
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, "", {
      maxAge: 0,
      path: "/",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    }),
    serializeCookie(REFRESH_COOKIE, "", {
      maxAge: 0,
      path: "/auth",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    })
  ]);
}

function bearerToken(req: express.Request) {
  const authorization = req.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requestAccessToken(req: express.Request) {
  return bearerToken(req) || parseCookies(req.headers.cookie).echoverse_access || "";
}

function requestRefreshToken(req: express.Request) {
  return String(req.body?.refreshToken || parseCookies(req.headers.cookie).echoverse_refresh || "");
}

function clientAuthResponse(
  req: express.Request,
  res: express.Response,
  account: Account,
  tokens: SessionTokens
) {
  if (isDesktopRequest(req)) {
    return res.json({ ok: true, ...sessionResponse(account, tokens) });
  }
  setWebSessionCookies(res, tokens);
  return res.json({ ok: true, account: publicAccount(account) });
}

app.use("/auth", authHttpRateLimit);

async function initDatabase() {
  if (!pool) {
    console.log("EchoVerse accounts: in-memory fallback");
    return;
  }
  if (postgresPool) {
    await runMigrations(postgresPool);
    console.log("EchoVerse accounts/friends/DM: PostgreSQL ready");
    return;
  }
  await runSqliteMigrations(sqliteDatabase!);
  console.log("EchoVerse accounts/friends/DM: SQLite ready");
}

async function accountById(id: string): Promise<Account | null> {
  if (!id) return null;

  if (!pool) {
    return memoryAccounts.get(id) || null;
  }

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
      (a) => a.username.toLowerCase() === username.toLowerCase()
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

function friendshipKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function parseReactions(value: unknown): Record<string, string[]> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const reactions: Record<string, string[]> = {};
  for (const [emoji, accountIds] of Object.entries(value)) {
    if (!Array.isArray(accountIds)) continue;
    const validAccountIds = accountIds.filter(
      (accountId): accountId is string => typeof accountId === "string" && accountId.length <= 128
    );
    if (validAccountIds.length) reactions[emoji] = validAccountIds;
  }
  return reactions;
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

async function findUsersByUsername(query: string, selfId: string) {
  const clean = String(query || "")
    .trim()
    .toLowerCase()
    .slice(0, 40);
  if (!clean) return [];

  if (!pool) {
    return [...memoryAccounts.values()]
      .filter((a) => a.id !== selfId && a.username.toLowerCase().includes(clean))
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        username: a.username,
        avatarData: a.avatarData
      }));
  }

  const result = await pool.query(
    `SELECT id, username, avatar_data
     FROM echoverse_users
     WHERE id <> $1 AND LOWER(username) LIKE $2
     ORDER BY username
     LIMIT 20`,
    [selfId, `%${clean}%`]
  );

  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    avatarData: row.avatar_data || null
  }));
}

async function friendshipBetween(a: string, b: string) {
  if (!pool) {
    return memoryFriendships.get(friendshipKey(a, b)) || null;
  }

  const result = await pool.query(
    `SELECT id, requester_id, addressee_id, status, created_at
     FROM echoverse_friendships
     WHERE
       (requester_id = $1 AND addressee_id = $2)
       OR
       (requester_id = $2 AND addressee_id = $1)
     LIMIT 1`,
    [a, b]
  );

  return result.rows[0] || null;
}

async function listFriendState(accountId: string) {
  if (!pool) {
    const accepted: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];

    for (const f of memoryFriendships.values()) {
      if (f.status === "accepted" && (f.requesterId === accountId || f.addresseeId === accountId)) {
        const otherId = f.requesterId === accountId ? f.addresseeId : f.requesterId;
        const other = await publicUserById(otherId);
        if (other) accepted.push(other);
      } else if (f.status === "pending" && f.addresseeId === accountId) {
        const other = await publicUserById(f.requesterId);
        if (other) incoming.push({ ...other, friendshipId: f.id });
      } else if (f.status === "pending" && f.requesterId === accountId) {
        const other = await publicUserById(f.addresseeId);
        if (other) outgoing.push({ ...other, friendshipId: f.id });
      }
    }

    return { accepted, incoming, outgoing };
  }

  const result = await pool.query(
    `SELECT f.id, f.requester_id, f.addressee_id, f.status,
            u1.username AS requester_username,
            u1.avatar_data AS requester_avatar,
            u2.username AS addressee_username,
            u2.avatar_data AS addressee_avatar
     FROM echoverse_friendships f
     JOIN echoverse_users u1 ON u1.id = f.requester_id
     JOIN echoverse_users u2 ON u2.id = f.addressee_id
     WHERE f.requester_id = $1 OR f.addressee_id = $1`,
    [accountId]
  );

  const accepted: any[] = [];
  const incoming: any[] = [];
  const outgoing: any[] = [];

  for (const row of result.rows) {
    if (row.status === "accepted") {
      if (row.requester_id === accountId) {
        accepted.push({
          id: row.addressee_id,
          username: row.addressee_username,
          avatarData: row.addressee_avatar || null
        });
      } else {
        accepted.push({
          id: row.requester_id,
          username: row.requester_username,
          avatarData: row.requester_avatar || null
        });
      }
    } else if (row.status === "pending" && row.addressee_id === accountId) {
      incoming.push({
        id: row.requester_id,
        username: row.requester_username,
        avatarData: row.requester_avatar || null,
        friendshipId: row.id
      });
    } else if (row.status === "pending" && row.requester_id === accountId) {
      outgoing.push({
        id: row.addressee_id,
        username: row.addressee_username,
        avatarData: row.addressee_avatar || null,
        friendshipId: row.id
      });
    }
  }

  return { accepted, incoming, outgoing };
}

async function areFriends(a: string, b: string) {
  const f = await friendshipBetween(a, b);
  const status = f?.status;
  return status === "accepted";
}

async function storeDm(
  senderId: string,
  recipientId: string,
  body: string,
  options: {
    replyToId?: string | null;
    attachmentName?: string | null;
    attachmentMime?: string | null;
    attachmentData?: string | null;
  } = {}
) {
  const msg: StoredDm = {
    id: crypto.randomUUID(),
    senderId,
    recipientId,
    body,
    createdAt: new Date().toISOString(),
    replyToId: options.replyToId || null,
    editedAt: null,
    deletedAt: null,
    attachmentName: options.attachmentName || null,
    attachmentMime: options.attachmentMime || null,
    attachmentData: options.attachmentData || null,
    reactions: {}
  };

  if (!pool) {
    memoryDmMessages.push(msg);
    return msg;
  }

  await pool.query(
    `INSERT INTO echoverse_dm_messages
      (
        id, sender_id, recipient_id, body, created_at,
        reply_to_id, attachment_name, attachment_mime, attachment_data, reactions
      )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [
      msg.id,
      senderId,
      recipientId,
      body,
      msg.createdAt,
      msg.replyToId,
      msg.attachmentName,
      msg.attachmentMime,
      msg.attachmentData,
      JSON.stringify(msg.reactions)
    ]
  );

  return msg;
}

async function loadDmHistory(a: string, b: string) {
  if (!pool) {
    return memoryDmMessages
      .filter(
        (m) =>
          (m.senderId === a && m.recipientId === b) || (m.senderId === b && m.recipientId === a)
      )
      .slice(-200);
  }

  const result = await pool.query(
    `SELECT
       id, sender_id, recipient_id, body, created_at,
       reply_to_id, edited_at, deleted_at,
       attachment_name, attachment_mime, attachment_data, reactions
     FROM (
       SELECT
         id, sender_id, recipient_id, body, created_at,
         reply_to_id, edited_at, deleted_at,
         attachment_name, attachment_mime, attachment_data, reactions
       FROM echoverse_dm_messages
       WHERE
         (sender_id = $1 AND recipient_id = $2)
         OR
         (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at DESC
       LIMIT 200
     ) q
     ORDER BY created_at ASC`,
    [a, b]
  );

  return result.rows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.deleted_at ? "" : row.body,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at),
    replyToId: row.reply_to_id || null,
    editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
    deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || null,
    attachmentName: row.deleted_at ? null : row.attachment_name || null,
    attachmentMime: row.deleted_at ? null : row.attachment_mime || null,
    attachmentData: row.deleted_at ? null : row.attachment_data || null,
    reactions: parseReactions(row.reactions)
  }));
}

async function dmById(messageId: string): Promise<StoredDm | null> {
  if (!pool) {
    return memoryDmMessages.find((m) => m.id === messageId) || null;
  }

  const result = await pool.query(
    `SELECT
      id, sender_id, recipient_id, body, created_at,
      reply_to_id, edited_at, deleted_at,
      attachment_name, attachment_mime, attachment_data, reactions
     FROM echoverse_dm_messages
     WHERE id=$1 LIMIT 1`,
    [messageId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.deleted_at ? "" : row.body,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at),
    replyToId: row.reply_to_id || null,
    editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
    deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || null,
    attachmentName: row.deleted_at ? null : row.attachment_name || null,
    attachmentMime: row.deleted_at ? null : row.attachment_mime || null,
    attachmentData: row.deleted_at ? null : row.attachment_data || null,
    reactions: parseReactions(row.reactions)
  };
}

function emitToAccount(accountId: string, event: string, payload: any) {
  for (const peer of io.sockets.sockets.values()) {
    if ((peer.data as any).account?.id === accountId) {
      peer.emit(event, payload);
    }
  }
}

function emitDmPair(msg: StoredDm, event: string, payload: any) {
  emitToAccount(msg.senderId, event, payload);
  emitToAccount(msg.recipientId, event, payload);
}

function validateAttachment(input: any) {
  if (!input) return { ok: true, value: null };

  const parsed = attachmentSchema.safeParse({
    name: input.name,
    mime: input.mime || "application/octet-stream",
    data: input.data
  });
  if (!parsed.success) {
    return { ok: false, error: "Dosya verisi geçersiz." };
  }

  return {
    ok: true,
    value: parsed.data
  };
}

function socketForAccount(accountId: string) {
  return [...users.values()].find((u) => u.accountId === accountId);
}

function guildList() {
  return [...guilds.values()];
}

function roomFor(guildId: string) {
  return `guild:${guildId}:lobby`;
}

function getPresence(roomId: string) {
  return [...users.values()]
    .filter((u) => u.roomId === roomId)
    .map((u) => ({
      socketId: u.socketId,
      userId: u.userId,
      username: u.username,
      avatarData: u.avatarData
    }));
}

function broadcastPresence(roomId: string) {
  const members = getPresence(roomId);
  io.to(roomId).emit("presence", members);
  io.to(roomId).emit("voice:lobby-state", { members, syncedAt: Date.now() });
}

function sendLobbyState(socket: any, roomId: string) {
  socket.emit("voice:lobby-state", {
    members: getPresence(roomId),
    syncedAt: Date.now()
  });
}

function leaveCurrentRoom(socket: any, user: User) {
  if (!user.roomId) return;

  const oldRoom = user.roomId;
  const oldGuild = user.guildId;

  socket.leave(oldRoom);
  socket.to(oldRoom).emit("peer-left", { socketId: socket.id, username: user.username });

  if (oldGuild) {
    const party = spotifyParties.get(oldGuild);
    if (party?.leaderSocketId === socket.id) {
      spotifyParties.delete(oldGuild);
      io.to(oldRoom).emit("spotify:party-ended");
    }
  }

  user.roomId = undefined;
  user.guildId = undefined;
  users.set(socket.id, user);

  broadcastPresence(oldRoom);
}

function attachAccountToSocket(socket: any, account: Account, sessionId?: string) {
  const current = users.get(socket.id);

  const user: User = {
    socketId: socket.id,
    userId: account.id,
    accountId: account.id,
    username: account.username,
    avatarData: account.avatarData,
    roomId: current?.roomId,
    guildId: current?.guildId
  };

  users.set(socket.id, user);
  socket.data.account = account;
  if (sessionId) socket.data.sessionId = sessionId;

  return publicAccount(account);
}

io.on("connection", (socket) => {
  socket.data.protocolVersion = PROTOCOL_VERSION;
  socket.emit("protocol:ready", { version: PROTOCOL_VERSION });
  socket.emit("guild:list", guildList());

  if (socket.data.account) {
    attachAccountToSocket(socket, socket.data.account, socket.data.sessionId);
    socket.emit("auth:session", { ok: true, account: publicAccount(socket.data.account) });
  }

  const handlerRateLimitedEvents = new Set([
    "auth:register",
    "auth:login",
    "dm:send",
    "webrtc-offer",
    "webrtc-answer",
    "webrtc-ice"
  ]);

  socket.use(([event, payload], next) => {
    const eventName = String(event);
    if (!socketPayloadWithinLimit(payload)) {
      next(new Error(`Payload exceeds ${MAX_SOCKET_PACKET_BYTES} bytes`));
      return;
    }
    if (
      !handlerRateLimitedEvents.has(eventName) &&
      !allowSocketEvent(socket.id, eventName, socketEventLimit(eventName))
    ) {
      next(new Error("Too many requests"));
      return;
    }
    if (!socket.data.sessionId) {
      next();
      return;
    }
    if (sessionManager.verifyAccess(String(socket.data.accessToken || ""))) {
      next();
      return;
    }
    socket.emit("auth:expired");
    socket.disconnect(true);
    next(new Error("Session expired"));
  });

  onValidatedSocketEvent(socket, "auth:register", async (payload, callback) => {
    if (socket.data.client !== "desktop") {
      callback?.({ ok: false, error: "Web girişleri HTTP oturum uç noktasını kullanmalı." });
      return;
    }
    if (!allowSocketEvent(socket.id, "auth", 8)) {
      callback?.({ ok: false, error: "Çok fazla deneme. Lütfen biraz sonra tekrar dene." });
      return;
    }
    try {
      const parsed = registerCredentialsSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ ok: false, error: "Kayıt bilgileri geçersiz." });
        return;
      }
      const email = sanitizeEmail(parsed.data.email);
      const username = sanitizeName(parsed.data.username);
      const password = parsed.data.password;

      if (!validEmail(email)) {
        callback?.({ ok: false, error: "Geçerli bir e-posta yaz." });
        return;
      }

      if (username.length < 3) {
        callback?.({ ok: false, error: "Kullanıcı adı en az 3 karakter olmalı." });
        return;
      }

      if (password.length < 6) {
        callback?.({ ok: false, error: "Şifre en az 6 karakter olmalı." });
        return;
      }

      if (await accountByEmail(email)) {
        callback?.({ ok: false, error: "Bu e-posta zaten kayıtlı." });
        return;
      }

      if (await usernameExists(username)) {
        callback?.({ ok: false, error: "Bu kullanıcı adı alınmış." });
        return;
      }

      const hash = await bcrypt.hash(password, 12);
      const account = await createAccount(email, username, hash);
      const tokens = sessionManager.issue(account.id);
      attachAccountToSocket(socket, account, tokens.sessionId);
      socket.data.accessToken = tokens.accessToken;

      callback?.({ ok: true, ...sessionResponse(account, tokens) });
    } catch {
      console.error("register error");
      callback?.({ ok: false, error: "Hesap oluşturulamadı." });
    }
  });

  onValidatedSocketEvent(socket, "auth:login", async (payload, callback) => {
    if (socket.data.client !== "desktop") {
      callback?.({ ok: false, error: "Web girişleri HTTP oturum uç noktasını kullanmalı." });
      return;
    }
    if (!allowSocketEvent(socket.id, "auth", 8)) {
      callback?.({ ok: false, error: "Çok fazla deneme. Lütfen biraz sonra tekrar dene." });
      return;
    }
    try {
      const parsed = authCredentialsSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ ok: false, error: "E-posta veya şifre yanlış." });
        return;
      }
      const email = sanitizeEmail(parsed.data.email);
      const password = parsed.data.password;

      const account = await accountByEmail(email);

      if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        callback?.({ ok: false, error: "E-posta veya şifre yanlış." });
        return;
      }

      const tokens = sessionManager.issue(account.id);
      attachAccountToSocket(socket, account, tokens.sessionId);
      socket.data.accessToken = tokens.accessToken;
      callback?.({ ok: true, ...sessionResponse(account, tokens) });
    } catch {
      console.error("login error");
      callback?.({ ok: false, error: "Giriş yapılamadı." });
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
        callback?.({ ok: false, error: "Oturum geçersiz." });
        return;
      }

      let clean: string | null = null;

      if (payload?.avatarData) {
        clean = String(payload.avatarData);

        if (!/^data:image\/(png|jpeg|webp);base64,/i.test(clean)) {
          callback?.({ ok: false, error: "Geçersiz profil fotoğrafı." });
          return;
        }

        if (clean.length > 700_000) {
          callback?.({ ok: false, error: "Profil fotoğrafı çok büyük." });
          return;
        }
      }

      const account = await updateAvatar(accountId, clean);

      if (!account) {
        callback?.({ ok: false, error: "Hesap bulunamadı." });
        return;
      }

      const user = users.get(socket.id);
      if (user) {
        user.avatarData = account.avatarData;
        users.set(socket.id, user);
        if (user.roomId) broadcastPresence(user.roomId);
      }

      callback?.({
        ok: true,
        account: publicAccount(account)
      });
    } catch {
      console.error("avatar error");
      callback?.({ ok: false, error: "Profil fotoğrafı güncellenemedi." });
    }
  });

  // Backward compatibility for old clients during rollout.
  onValidatedSocketEvent(socket, "identify", async ({ token, userId, username }) => {
    const accountId = verifyToken(String(token || ""));

    if (accountId) {
      const account = await accountById(accountId);
      if (account) {
        attachAccountToSocket(socket, account, socket.data.sessionId);
        socket.emit("guild:list", guildList());
        return;
      }
    }

    users.set(socket.id, {
      socketId: socket.id,
      userId: String(userId || crypto.randomUUID()),
      username: sanitizeName(username) || "Guest",
      avatarData: null
    });

    socket.emit("guild:list", guildList());
  });

  onValidatedSocketEvent(socket, "friends:search", async ({ query }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    try {
      const results = await findUsersByUsername(query, user.accountId);
      callback?.({ ok: true, results });
    } catch {
      console.error("friends search error");
      callback?.({ ok: false, error: "Kullanıcı araması başarısız." });
    }
  });

  onValidatedSocketEvent(socket, "friends:list", async (_payload, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    try {
      const state = await listFriendState(user.accountId);
      callback?.({ ok: true, ...state });
    } catch {
      console.error("friends list error");
      callback?.({ ok: false, error: "Arkadaşlar alınamadı." });
    }
  });

  onValidatedSocketEvent(socket, "friends:request", async ({ targetId }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    const target = await accountById(String(targetId || ""));
    if (!target || target.id === user.accountId) {
      callback?.({ ok: false, error: "Kullanıcı bulunamadı." });
      return;
    }

    const existing = await friendshipBetween(user.accountId, target.id);
    if (existing) {
      callback?.({ ok: false, error: "Bu kullanıcıyla zaten bir arkadaşlık/istek kaydı var." });
      return;
    }

    const id = crypto.randomUUID();

    if (!pool) {
      memoryFriendships.set(friendshipKey(user.accountId, target.id), {
        id,
        requesterId: user.accountId,
        addresseeId: target.id,
        status: "pending",
        createdAt: new Date().toISOString()
      });
    } else {
      const createdAt = new Date().toISOString();
      await pool.query(
        `INSERT INTO echoverse_friendships
          (id, requester_id, addressee_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'pending', $4, $4)`,
        [id, user.accountId, target.id, createdAt]
      );
    }

    const targetSocket = socketForAccount(target.id);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("friends:changed");
      io.to(targetSocket.socketId).emit("friends:request-received", {
        id: user.accountId,
        username: user.username,
        avatarData: user.avatarData
      });
    }

    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:respond", async ({ friendshipId, accept }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    const id = String(friendshipId || "");

    if (!pool) {
      const row = [...memoryFriendships.values()].find((f) => f.id === id);
      if (!row || row.addresseeId !== user.accountId || row.status !== "pending") {
        callback?.({ ok: false, error: "İstek bulunamadı." });
        return;
      }

      if (accept) {
        row.status = "accepted";
        memoryFriendships.set(friendshipKey(row.requesterId, row.addresseeId), row);
      } else {
        memoryFriendships.delete(friendshipKey(row.requesterId, row.addresseeId));
      }

      const otherSocket = socketForAccount(row.requesterId);
      if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    } else {
      const result = await pool.query(
        `SELECT requester_id, addressee_id, status
         FROM echoverse_friendships
         WHERE id = $1
         LIMIT 1`,
        [id]
      );

      const row = result.rows[0];
      if (!row || row.addressee_id !== user.accountId || row.status !== "pending") {
        callback?.({ ok: false, error: "İstek bulunamadı." });
        return;
      }

      if (accept) {
        await pool.query(
          `UPDATE echoverse_friendships
           SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
      } else {
        await pool.query(`DELETE FROM echoverse_friendships WHERE id = $1`, [id]);
      }

      const otherSocket = socketForAccount(row.requester_id);
      if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    }

    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:remove", async ({ targetId }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    const target = String(targetId || "");

    if (!pool) {
      memoryFriendships.delete(friendshipKey(user.accountId, target));
    } else {
      await pool.query(
        `DELETE FROM echoverse_friendships
         WHERE
           (requester_id = $1 AND addressee_id = $2)
           OR
           (requester_id = $2 AND addressee_id = $1)`,
        [user.accountId, target]
      );
    }

    const otherSocket = socketForAccount(target);
    if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    socket.emit("friends:changed");

    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:block", async ({ targetId }, callback) => {
    const account = (socket.data as any).account;
    const target = String(targetId || "");
    if (!account || !target || account.id === target) {
      callback?.({ ok: false, error: "Kullanıcı engellenemedi." });
      return;
    }

    const existing = await friendshipBetween(account.id, target);

    if (!pool) {
      const key = friendshipKey(account.id, target);
      memoryFriendships.set(key, {
        id: existing?.id || crypto.randomUUID(),
        requesterId: account.id,
        addresseeId: target,
        status: "blocked",
        createdAt: existing?.createdAt || new Date().toISOString()
      });
    } else if (existing) {
      await pool.query(
        `UPDATE echoverse_friendships
         SET status='blocked', requester_id=$1, addressee_id=$2, updated_at=NOW()
         WHERE id=$3`,
        [account.id, target, existing.id]
      );
    } else {
      await pool.query(
        `INSERT INTO echoverse_friendships
          (id, requester_id, addressee_id, status, created_at, updated_at)
         VALUES ($1,$2,$3,'blocked',NOW(),NOW())`,
        [crypto.randomUUID(), account.id, target]
      );
    }

    socket.emit("friends:changed");
    emitToAccount(target, "friends:changed", {});
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:unblock", async ({ targetId }, callback) => {
    const account = (socket.data as any).account;
    const target = String(targetId || "");
    if (!account || !target) return callback?.({ ok: false });

    const existing = await friendshipBetween(account.id, target);
    if (!existing || existing.status !== "blocked") {
      return callback?.({ ok: false, error: "Engel bulunamadı." });
    }

    if (!pool) {
      memoryFriendships.delete(friendshipKey(account.id, target));
    } else {
      await pool.query(`DELETE FROM echoverse_friendships WHERE id=$1`, [existing.id]);
    }

    socket.emit("friends:changed");
    emitToAccount(target, "friends:changed", {});
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:history", async ({ friendId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");

    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: "Arkadaş değilsiniz." });
      return;
    }

    const messages = await loadDmHistory(user.accountId, friend);
    callback?.({ ok: true, messages });
  });

  onValidatedSocketEvent(
    socket,
    "dm:send",
    async ({ friendId, body, replyToId, attachment }, callback) => {
      if (!allowSocketEvent(socket.id, "dm:send", 30)) {
        callback?.({ ok: false, error: "Çok hızlı mesaj gönderiyorsun." });
        return;
      }
      const user = users.get(socket.id);
      const friend = String(friendId || "");
      const clean = sanitizeText(body);

      if (!user?.accountId) {
        callback?.({ ok: false, error: "Oturum gerekli." });
        return;
      }

      if (!(await areFriends(user.accountId, friend))) {
        callback?.({ ok: false, error: "Arkadaş değilsiniz." });
        return;
      }

      const checkedAttachment = validateAttachment(attachment);
      if (!checkedAttachment.ok) {
        callback?.({ ok: false, error: checkedAttachment.error });
        return;
      }

      if (!clean && !checkedAttachment.value) {
        callback?.({ ok: false, error: "Boş mesaj gönderilemez." });
        return;
      }

      const msg = await storeDm(user.accountId, friend, clean, {
        replyToId: replyToId ? String(replyToId) : null,
        attachmentName: checkedAttachment.value?.name || null,
        attachmentMime: checkedAttachment.value?.mime || null,
        attachmentData: checkedAttachment.value?.data || null
      });

      const payload = {
        ...msg,
        senderUsername: user.username,
        senderAvatarData: user.avatarData
      };

      emitDmPair(msg, "dm:message", payload);
      callback?.({ ok: true, message: payload });
    }
  );

  onValidatedSocketEvent(socket, "dm:edit", async ({ messageId, body }, callback) => {
    const account = (socket.data as any).account;
    const msg = await dmById(String(messageId || ""));
    const clean = sanitizeText(body);

    if (!account || !msg || msg.senderId !== account.id || msg.deletedAt || !clean) {
      callback?.({ ok: false, error: "Mesaj düzenlenemedi." });
      return;
    }

    const editedAt = new Date().toISOString();

    if (!pool) {
      msg.body = clean;
      msg.editedAt = editedAt;
    } else {
      await pool.query(`UPDATE echoverse_dm_messages SET body=$1, edited_at=$2 WHERE id=$3`, [
        clean,
        editedAt,
        msg.id
      ]);
      msg.body = clean;
      msg.editedAt = editedAt;
    }

    emitDmPair(msg, "dm:updated", msg);
    callback?.({ ok: true, message: msg });
  });

  onValidatedSocketEvent(socket, "dm:delete", async ({ messageId }, callback) => {
    const account = (socket.data as any).account;
    const msg = await dmById(String(messageId || ""));

    if (!account || !msg || msg.senderId !== account.id || msg.deletedAt) {
      callback?.({ ok: false, error: "Mesaj silinemedi." });
      return;
    }

    const deletedAt = new Date().toISOString();

    if (!pool) {
      msg.body = "";
      msg.deletedAt = deletedAt;
      msg.attachmentName = null;
      msg.attachmentMime = null;
      msg.attachmentData = null;
    } else {
      await pool.query(
        `UPDATE echoverse_dm_messages
         SET body='', deleted_at=$1,
             attachment_name=NULL, attachment_mime=NULL, attachment_data=NULL
         WHERE id=$2`,
        [deletedAt, msg.id]
      );
      msg.body = "";
      msg.deletedAt = deletedAt;
      msg.attachmentName = null;
      msg.attachmentMime = null;
      msg.attachmentData = null;
    }

    emitDmPair(msg, "dm:deleted", { messageId: msg.id, deletedAt });
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "call:start", async ({ friendId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");

    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: "Arama için arkadaş olmanız gerekiyor." });
      return;
    }

    const friendSocket = socketForAccount(friend);
    if (!friendSocket) {
      callback?.({ ok: false, error: "Kullanıcı çevrimdışı." });
      return;
    }

    const callId = crypto.randomUUID();

    const callTimer = setTimeout(() => {
      const pending = pendingCalls.get(callId);
      if (!pending) return;

      pendingCalls.delete(callId);
      io.to(pending.callerSocketId).emit("call:answered", {
        callId,
        accept: false,
        reason: "timeout"
      });
      io.to(pending.targetSocketId).emit("call:missed", {
        callId,
        fromAccountId: pending.callerAccountId
      });
    }, 35000);

    pendingCalls.set(callId, {
      callerAccountId: user.accountId,
      callerSocketId: socket.id,
      targetAccountId: friend,
      targetSocketId: friendSocket.socketId,
      timer: callTimer
    });

    io.to(friendSocket.socketId).emit("call:incoming", {
      callId,
      fromAccountId: user.accountId,
      fromSocketId: socket.id,
      fromUsername: user.username,
      fromAvatarData: user.avatarData
    });

    callback?.({
      ok: true,
      callId,
      targetSocketId: friendSocket.socketId
    });
  });

  onValidatedSocketEvent(socket, "call:answer", ({ callId, toSocketId, accept }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const pending = pendingCalls.get(String(callId));
    if (pending) {
      clearTimeout(pending.timer);
      pendingCalls.delete(String(callId));
    }

    io.to(String(toSocketId)).emit("call:answered", {
      callId,
      accept: !!accept,
      responderSocketId: socket.id,
      responderAccountId: user.accountId || user.userId,
      responderUsername: user.username,
      responderAvatarData: user.avatarData
    });
  });

  onValidatedSocketEvent(socket, "call:end", ({ toSocketId, callId }) => {
    const pending = pendingCalls.get(String(callId));
    if (pending) {
      clearTimeout(pending.timer);
      pendingCalls.delete(String(callId));
    }
    io.to(String(toSocketId)).emit("call:ended", { callId });
  });

  onValidatedSocketEvent(socket, "guild:create", ({ name }, callback) => {
    const user = users.get(socket.id);
    if (!user) {
      callback?.({ ok: false, error: "Önce giriş yap." });
      return;
    }

    const guildName = sanitizeName(name, 32);

    if (!guildName) {
      callback?.({ ok: false, error: "Sunucu adı boş olamaz." });
      return;
    }

    const id = crypto.randomBytes(4).toString("hex");

    const guild: Guild = {
      id,
      name: guildName,
      createdBy: user.userId,
      createdAt: new Date().toISOString()
    };

    guilds.set(id, guild);
    io.emit("guild:list", guildList());

    callback?.({ ok: true, guild });
  });

  onValidatedSocketEvent(socket, "guild:join-code", ({ code }, callback) => {
    const id = String(code ?? "")
      .trim()
      .toLowerCase();

    if (!guilds.has(id)) {
      callback?.({ ok: false, error: "Sunucu kodu bulunamadı." });
      return;
    }

    callback?.({ ok: true, guild: guilds.get(id) });
  });

  onValidatedSocketEvent(socket, "join-room", ({ guildId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = guilds.has(String(guildId)) ? String(guildId) : "echoverse";

    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    users.set(socket.id, user);

    socket.join(roomId);

    const peers = getPresence(roomId).filter((p) => p.socketId !== socket.id);

    socket.emit("room-peers", peers);
    sendLobbyState(socket, roomId);

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData
    });

    const party = spotifyParties.get(safeGuild);
    if (party?.active) socket.emit("spotify:party-state", party);

    broadcastPresence(roomId);
  });

  onValidatedSocketEvent(socket, "voice:sync-request", () => {
    const user = users.get(socket.id);
    if (!user?.roomId) {
      socket.emit("voice:lobby-state", { members: [], syncedAt: Date.now() });
      return;
    }
    sendLobbyState(socket, user.roomId);
  });

  onValidatedSocketEvent(socket, "leave-room", () => {
    const user = users.get(socket.id);
    if (!user) return;
    leaveCurrentRoom(socket, user);
    socket.emit("presence", []);
    socket.emit("voice:lobby-state", { members: [], syncedAt: Date.now() });
  });

  onValidatedSocketEvent(socket, "chat-message", (payload) => {
    const user = users.get(socket.id);
    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) return;
    const { guildId, text } = parsed.data;
    if (!user || !user.roomId || user.guildId !== guildId) return;

    const safeText = sanitizeText(text);
    if (!safeText) return;

    const msg = {
      id: crypto.randomUUID(),
      guildId,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData,
      text: safeText,
      createdAt: new Date().toISOString()
    };

    io.to(user.roomId).emit("chat-message", msg);

    const cmd = safeText.toLowerCase();

    const bot = (botText: string) => {
      io.to(user.roomId!).emit("chat-message", {
        id: crypto.randomUUID(),
        guildId,
        userId: "bot:utility",
        username: "EchoBot",
        avatarData: null,
        text: botText,
        bot: true,
        createdAt: new Date().toISOString()
      });
    };

    const botText = utilityBotResponse(cmd);
    if (botText) bot(botText);
  });

  onValidatedSocketEvent(socket, "spotify:party-start", ({ guildId }) => {
    const user = users.get(socket.id);
    if (!user || user.guildId !== guildId || !user.roomId) return;

    const state: SpotifyPartyState = {
      guildId,
      leaderSocketId: socket.id,
      leaderUsername: user.username,
      active: true,
      updatedAt: Date.now()
    };

    spotifyParties.set(guildId, state);
    io.to(user.roomId).emit("spotify:party-state", state);
  });

  onValidatedSocketEvent(socket, "spotify:party-stop", ({ guildId }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user || !party || party.leaderSocketId !== socket.id) return;

    spotifyParties.delete(guildId);
    io.to(roomFor(guildId)).emit("spotify:party-ended");
  });

  onValidatedSocketEvent(socket, "spotify:sync", ({ guildId, state }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user || !party || party.leaderSocketId !== socket.id) return;

    const next: SpotifyPartyState = {
      ...party,
      ...state,
      guildId,
      leaderSocketId: socket.id,
      leaderUsername: user.username,
      active: true,
      updatedAt: Date.now()
    };

    spotifyParties.set(guildId, next);
    socket.to(roomFor(guildId)).emit("spotify:sync", next);
  });

  onValidatedSocketEvent(socket, "webrtc-offer", (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 120)) return;
    const parsed = webrtcDescriptionSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, sdp } = parsed.data;
    io.to(String(to)).emit("webrtc-offer", {
      from: socket.id,
      sdp
    });
  });

  onValidatedSocketEvent(socket, "webrtc-answer", (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 120)) return;
    const parsed = webrtcDescriptionSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, sdp } = parsed.data;
    io.to(String(to)).emit("webrtc-answer", {
      from: socket.id,
      sdp
    });
  });

  onValidatedSocketEvent(socket, "webrtc-ice", (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 240)) return;
    const parsed = webrtcIceCandidateSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, candidate } = parsed.data;
    io.to(String(to)).emit("webrtc-ice", {
      from: socket.id,
      candidate
    });
  });

  onValidatedSocketEvent(socket, "presence:set", ({ status }, callback) => {
    const account = (socket.data as any).account;
    if (!account) return callback?.({ ok: false, error: "Oturum gerekli." });
    const allowed = ["online", "idle", "dnd", "invisible"];
    const value = allowed.includes(status) ? status : "online";
    accountPresence.set(account.id, value);
    io.emit("presence:changed", { accountId: account.id, status: value });
    callback?.({ ok: true, status: value });
  });

  onValidatedSocketEvent(socket, "presence:get", ({ accountIds }, callback) => {
    const presence: Record<string, string> = {};
    for (const id of accountIds || []) presence[id] = accountPresence.get(id) || "offline";
    callback?.({ ok: true, presence });
  });

  onValidatedSocketEvent(socket, "dm:typing", ({ friendId, typing }) => {
    const account = (socket.data as any).account;
    if (!account || !friendId) return;
    for (const peer of io.sockets.sockets.values()) {
      if ((peer.data as any).account?.id === friendId) {
        peer.emit("dm:typing", { accountId: account.id, typing: !!typing });
      }
    }
  });

  onValidatedSocketEvent(socket, "dm:read", ({ friendId }, callback) => {
    const account = (socket.data as any).account;
    if (!account || !friendId) return callback?.({ ok: false });
    dmReadAt.set(`${account.id}:${friendId}`, Date.now());
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:react", async ({ messageId, emoji }, callback) => {
    const account = (socket.data as any).account;
    const msg = await dmById(String(messageId || ""));
    const cleanEmoji = String(emoji || "").slice(0, 12);

    if (!account || !msg || !cleanEmoji) {
      callback?.({ ok: false, error: "Reaction eklenemedi." });
      return;
    }

    if (account.id !== msg.senderId && account.id !== msg.recipientId) {
      callback?.({ ok: false, error: "Bu mesaja erişimin yok." });
      return;
    }

    const reactions = { ...(msg.reactions || {}) };
    const set = new Set(reactions[cleanEmoji] || []);
    if (set.has(account.id)) set.delete(account.id);
    else set.add(account.id);

    if (set.size) reactions[cleanEmoji] = [...set];
    else delete reactions[cleanEmoji];

    msg.reactions = reactions;

    if (!pool) {
      const memory = memoryDmMessages.find((m) => m.id === msg.id);
      if (memory) memory.reactions = reactions;
    } else {
      await pool.query(`UPDATE echoverse_dm_messages SET reactions=$1::jsonb WHERE id=$2`, [
        JSON.stringify(reactions),
        msg.id
      ]);
    }

    emitDmPair(msg, "dm:reaction", { messageId: msg.id, reactions });
    callback?.({ ok: true, reactions });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user?.roomId && user.guildId) {
      const oldRoom = user.roomId;
      const party = spotifyParties.get(user.guildId);

      if (party?.leaderSocketId === socket.id) {
        spotifyParties.delete(user.guildId);
        io.to(oldRoom).emit("spotify:party-ended");
      }

      socket.to(oldRoom).emit("peer-left", {
        socketId: socket.id,
        username: user.username
      });

      users.delete(socket.id);
      clearSocketLimits(socket.id);
      broadcastPresence(oldRoom);
    } else {
      users.delete(socket.id);
      clearSocketLimits(socket.id);
    }
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const parsed = registerCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Kayıt bilgileri geçersiz." });
      return;
    }

    const email = sanitizeEmail(parsed.data.email);
    const username = sanitizeName(parsed.data.username);
    if (!validEmail(email) || username.length < 3 || parsed.data.password.length < 6) {
      res.status(400).json({ ok: false, error: "Kayıt bilgileri geçersiz." });
      return;
    }
    if (await accountByEmail(email)) {
      res.status(409).json({ ok: false, error: "Bu e-posta zaten kayıtlı." });
      return;
    }
    if (await usernameExists(username)) {
      res.status(409).json({ ok: false, error: "Bu kullanıcı adı alınmış." });
      return;
    }

    const account = await createAccount(
      email,
      username,
      await bcrypt.hash(parsed.data.password, 12)
    );
    return clientAuthResponse(req, res, account, sessionManager.issue(account.id));
  } catch {
    console.error("http register error");
    res.status(500).json({ ok: false, error: "Hesap oluşturulamadı." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const parsed = authCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(401).json({ ok: false, error: "E-posta veya şifre yanlış." });
      return;
    }

    const account = await accountByEmail(sanitizeEmail(parsed.data.email));
    if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
      res.status(401).json({ ok: false, error: "E-posta veya şifre yanlış." });
      return;
    }

    return clientAuthResponse(req, res, account, sessionManager.issue(account.id));
  } catch {
    console.error("http login error");
    res.status(500).json({ ok: false, error: "Giriş yapılamadı." });
  }
});

app.post("/auth/refresh", async (req, res) => {
  const refreshToken = requestRefreshToken(req);
  const tokens = refreshToken ? sessionManager.rotate(refreshToken) : null;
  if (!tokens) {
    clearWebSessionCookies(res);
    res.status(401).json({ ok: false, error: "Oturum yenilenemedi." });
    return;
  }

  const verified = sessionManager.verifyAccess(tokens.accessToken);
  const account = verified ? await accountById(verified.userId) : null;
  if (!account) {
    clearWebSessionCookies(res);
    res.status(401).json({ ok: false, error: "Oturum yenilenemedi." });
    return;
  }

  return clientAuthResponse(req, res, account, tokens);
});

app.get("/auth/session", async (req, res) => {
  const verified = sessionManager.verifyAccess(requestAccessToken(req));
  const account = verified ? await accountById(verified.userId) : null;
  if (!account) {
    res.status(401).json({ ok: false, error: "Oturum gerekli." });
    return;
  }
  res.json({ ok: true, account: publicAccount(account) });
});

app.post("/auth/logout", (req, res) => {
  const accessToken = requestAccessToken(req);
  const refreshToken = requestRefreshToken(req);
  if (accessToken) sessionManager.revokeAccess(accessToken);
  if (refreshToken) sessionManager.revokeRefresh(refreshToken);
  clearWebSessionCookies(res);
  res.json({ ok: true });
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(400).json({ ok: false, error: "İstek işlenemedi." });
  }
);

const PORT = config.port;

export { app, httpServer, io, initDatabase };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  initDatabase()
    .then(() => {
      httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`EchoVerse Server v${APP_VERSION} listening on ${PORT}`);
      });
    })
    .catch(() => {
      console.error("Database init failed");
      process.exit(1);
    });
}
