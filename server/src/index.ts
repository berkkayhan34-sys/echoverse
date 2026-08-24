import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import { Server } from "socket.io";

const { Pool } = pg;

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "EchoVerse Server",
    version: "1.6.1",
    ok: true,
    database: process.env.DATABASE_URL ? "postgres" : "memory",
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: "1.6.1",
    database: process.env.DATABASE_URL ? "postgres" : "memory"
  });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 2e6
});

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "echoverse-dev-secret-change-this-in-render";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined
    })
  : null;

type Account = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarData: string | null;
  createdAt: string;
};

type PublicAccount = {
  id: string;
  email: string;
  username: string;
  avatarData: string | null;
};

type User = {
  socketId: string;
  userId: string;
  username: string;
  avatarData: string | null;
  accountId?: string;
  roomId?: string;
  guildId?: string;
};

type Guild = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

type SpotifyPartyState = {
  guildId: string;
  leaderSocketId: string;
  leaderUsername: string;
  active: boolean;
  trackUri?: string;
  trackName?: string;
  artistName?: string;
  albumImage?: string;
  positionMs?: number;
  isPlaying?: boolean;
  updatedAt?: number;
};

const users = new Map<string, User>();
const guilds = new Map<string, Guild>();
const spotifyParties = new Map<string, SpotifyPartyState>();

// Fallback only. Use Render PostgreSQL for persistence.
const memoryAccounts = new Map<string, Account>();
const memoryFriendships = new Map<string, {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: string;
}>();
const memoryDmMessages: Array<{
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}> = [];

guilds.set("echoverse", {
  id: "echoverse",
  name: "EchoVerse",
  createdBy: "system",
  createdAt: new Date().toISOString()
});

function sanitizeName(value: unknown, max = 28) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function sanitizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 160);
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().slice(0, 2500);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    avatarData: account.avatarData
  };
}

function signToken(account: Account) {
  return jwt.sign(
    {
      sub: account.id,
      username: account.username,
      email: account.email
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return String(decoded.sub || "");
  } catch {
    return "";
  }
}

async function initDatabase() {
  if (!pool) {
    console.log("EchoVerse accounts: in-memory fallback");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS echoverse_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS echoverse_friendships (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
      addressee_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(requester_id, addressee_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS echoverse_dm_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS echoverse_dm_pair_idx
    ON echoverse_dm_messages(sender_id, recipient_id, created_at)
  `);

  console.log("EchoVerse accounts/friends/DM: PostgreSQL ready");
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
      a => a.username.toLowerCase() === username.toLowerCase()
    );
  }

  const result = await pool.query(
    `SELECT 1 FROM echoverse_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username]
  );

  return result.rowCount > 0;
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

  await pool.query(
    `UPDATE echoverse_users SET avatar_data = $1 WHERE id = $2`,
    [avatarData, accountId]
  );

  return accountById(accountId);
}


function friendshipKey(a: string, b: string) {
  return [a, b].sort().join(":");
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
  const clean = String(query || "").trim().toLowerCase().slice(0, 40);
  if (!clean) return [];

  if (!pool) {
    return [...memoryAccounts.values()]
      .filter(a =>
        a.id !== selfId &&
        a.username.toLowerCase().includes(clean)
      )
      .slice(0, 20)
      .map(a => ({
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

  return result.rows.map(row => ({
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
      if (f.status === "accepted" &&
          (f.requesterId === accountId || f.addresseeId === accountId)) {
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

async function storeDm(senderId: string, recipientId: string, body: string) {
  const msg = {
    id: crypto.randomUUID(),
    senderId,
    recipientId,
    body,
    createdAt: new Date().toISOString()
  };

  if (!pool) {
    memoryDmMessages.push(msg);
    return msg;
  }

  await pool.query(
    `INSERT INTO echoverse_dm_messages
      (id, sender_id, recipient_id, body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [msg.id, senderId, recipientId, body, msg.createdAt]
  );

  return msg;
}

async function loadDmHistory(a: string, b: string) {
  if (!pool) {
    return memoryDmMessages
      .filter(m =>
        (m.senderId === a && m.recipientId === b) ||
        (m.senderId === b && m.recipientId === a)
      )
      .slice(-200);
  }

  const result = await pool.query(
    `SELECT id, sender_id, recipient_id, body, created_at
     FROM (
       SELECT id, sender_id, recipient_id, body, created_at
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

  return result.rows.map(row => ({
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at)
  }));
}

function socketForAccount(accountId: string) {
  return [...users.values()].find(u => u.accountId === accountId);
}

function guildList() {
  return [...guilds.values()];
}

function roomFor(guildId: string) {
  return `guild:${guildId}:lobby`;
}

function getPresence(roomId: string) {
  return [...users.values()]
    .filter(u => u.roomId === roomId)
    .map(u => ({
      socketId: u.socketId,
      userId: u.userId,
      username: u.username,
      avatarData: u.avatarData
    }));
}

function broadcastPresence(roomId: string) {
  io.to(roomId).emit("presence", getPresence(roomId));
}

function leaveCurrentRoom(socket: any, user: User) {
  if (!user.roomId) return;

  const oldRoom = user.roomId;
  const oldGuild = user.guildId;

  socket.leave(oldRoom);
  socket.to(oldRoom).emit("peer-left", { socketId: socket.id });

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

async function attachAccountToSocket(socket: any, account: Account) {
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

  return {
    token: signToken(account),
    account: publicAccount(account)
  };
}

const accountPresence = new Map<string, string>();
const dmReactions = new Map<string, Record<string, string[]>>();
const dmReadAt = new Map<string, number>();

io.on("connection", socket => {
  socket.emit("guild:list", guildList());

  socket.on("auth:register", async (payload, callback) => {
    try {
      const email = sanitizeEmail(payload?.email);
      const username = sanitizeName(payload?.username);
      const password = String(payload?.password || "");

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
      const session = await attachAccountToSocket(socket, account);

      callback?.({ ok: true, ...session });
    } catch (err: any) {
      console.error("register error", err);
      callback?.({ ok: false, error: "Hesap oluşturulamadı." });
    }
  });

  socket.on("auth:login", async (payload, callback) => {
    try {
      const email = sanitizeEmail(payload?.email);
      const password = String(payload?.password || "");

      const account = await accountByEmail(email);

      if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        callback?.({ ok: false, error: "E-posta veya şifre yanlış." });
        return;
      }

      const session = await attachAccountToSocket(socket, account);
      callback?.({ ok: true, ...session });
    } catch (err) {
      console.error("login error", err);
      callback?.({ ok: false, error: "Giriş yapılamadı." });
    }
  });

  socket.on("auth:resume", async ({ token }, callback) => {
    try {
      const accountId = verifyToken(String(token || ""));
      const account = await accountById(accountId);

      if (!account) {
        callback?.({ ok: false });
        return;
      }

      const session = await attachAccountToSocket(socket, account);
      callback?.({ ok: true, ...session });
    } catch {
      callback?.({ ok: false });
    }
  });

  socket.on("auth:logout", () => {
    const current = users.get(socket.id);
    if (current?.roomId) leaveCurrentRoom(socket, current);
    users.delete(socket.id);
  });

  socket.on("profile:set-avatar", async ({ token, avatarData }, callback) => {
    try {
      const accountId = verifyToken(String(token || ""));
      if (!accountId) {
        callback?.({ ok: false, error: "Oturum geçersiz." });
        return;
      }

      let clean: string | null = null;

      if (avatarData) {
        clean = String(avatarData);

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
    } catch (err) {
      console.error("avatar error", err);
      callback?.({ ok: false, error: "Profil fotoğrafı güncellenemedi." });
    }
  });

  // Backward compatibility for old clients during rollout.
  socket.on("identify", async ({ token, userId, username }) => {
    const accountId = verifyToken(String(token || ""));

    if (accountId) {
      const account = await accountById(accountId);
      if (account) {
        await attachAccountToSocket(socket, account);
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


  socket.on("friends:search", async ({ query }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    try {
      const results = await findUsersByUsername(query, user.accountId);
      callback?.({ ok: true, results });
    } catch (err) {
      console.error("friends search error", err);
      callback?.({ ok: false, error: "Kullanıcı araması başarısız." });
    }
  });

  socket.on("friends:list", async (_payload, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    try {
      const state = await listFriendState(user.accountId);
      callback?.({ ok: true, ...state });
    } catch (err) {
      console.error("friends list error", err);
      callback?.({ ok: false, error: "Arkadaşlar alınamadı." });
    }
  });

  socket.on("friends:request", async ({ targetId }, callback) => {
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
      await pool.query(
        `INSERT INTO echoverse_friendships
          (id, requester_id, addressee_id, status)
         VALUES ($1, $2, $3, 'pending')`,
        [id, user.accountId, target.id]
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

  socket.on("friends:respond", async ({ friendshipId, accept }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: "Oturum gerekli." });
      return;
    }

    const id = String(friendshipId || "");

    if (!pool) {
      const row = [...memoryFriendships.values()].find(f => f.id === id);
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
        await pool.query(
          `DELETE FROM echoverse_friendships WHERE id = $1`,
          [id]
        );
      }

      const otherSocket = socketForAccount(row.requester_id);
      if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    }

    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  socket.on("friends:remove", async ({ targetId }, callback) => {
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

  socket.on("dm:history", async ({ friendId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");

    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: "Arkadaş değilsiniz." });
      return;
    }

    const messages = await loadDmHistory(user.accountId, friend);
    callback?.({ ok: true, messages });
  });

  socket.on("dm:send", async ({ friendId, body }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");
    const clean = sanitizeText(body);

    if (!user?.accountId || !clean) {
      callback?.({ ok: false, error: "Mesaj gönderilemedi." });
      return;
    }

    if (!(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: "Arkadaş değilsiniz." });
      return;
    }

    const msg = await storeDm(user.accountId, friend, clean);

    const payload = {
      ...msg,
      senderUsername: user.username,
      senderAvatarData: user.avatarData
    };

    socket.emit("dm:message", payload);

    const friendSocket = socketForAccount(friend);
    if (friendSocket) {
      io.to(friendSocket.socketId).emit("dm:message", payload);
    }

    callback?.({ ok: true, message: payload });
  });

  socket.on("call:start", async ({ friendId }, callback) => {
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

  socket.on("call:answer", ({ callId, toSocketId, accept }) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.to(String(toSocketId)).emit("call:answered", {
      callId,
      accept: !!accept,
      responderSocketId: socket.id,
      responderAccountId: user.accountId || user.userId,
      responderUsername: user.username,
      responderAvatarData: user.avatarData
    });
  });

  socket.on("call:end", ({ toSocketId, callId }) => {
    io.to(String(toSocketId)).emit("call:ended", { callId });
  });

  socket.on("guild:create", ({ name }, callback) => {
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

  socket.on("guild:join-code", ({ code }, callback) => {
    const id = String(code ?? "").trim().toLowerCase();

    if (!guilds.has(id)) {
      callback?.({ ok: false, error: "Sunucu kodu bulunamadı." });
      return;
    }

    callback?.({ ok: true, guild: guilds.get(id) });
  });

  socket.on("join-room", ({ guildId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = guilds.has(String(guildId))
      ? String(guildId)
      : "echoverse";

    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    users.set(socket.id, user);

    socket.join(roomId);

    const peers = getPresence(roomId).filter(
      p => p.socketId !== socket.id
    );

    socket.emit("room-peers", peers);

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

  socket.on("leave-room", () => {
    const user = users.get(socket.id);
    if (!user) return;
    leaveCurrentRoom(socket, user);
    socket.emit("presence", []);
  });

  socket.on("chat-message", ({ guildId, text }) => {
    const user = users.get(socket.id);
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

    if (cmd === "!ping") bot("Pong 🏓");
    if (cmd === "!roll") bot(`🎲 ${Math.floor(Math.random() * 100) + 1}`);
    if (cmd === "!help") bot("Komutlar: !ping, !roll, !help");
  });

  socket.on("spotify:party-start", ({ guildId }) => {
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

  socket.on("spotify:party-stop", ({ guildId }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user || !party || party.leaderSocketId !== socket.id) return;

    spotifyParties.delete(guildId);
    io.to(roomFor(guildId)).emit("spotify:party-ended");
  });

  socket.on("spotify:sync", ({ guildId, state }) => {
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

  socket.on("webrtc-offer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-offer", {
      from: socket.id,
      sdp
    });
  });

  socket.on("webrtc-answer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-answer", {
      from: socket.id,
      sdp
    });
  });

  socket.on("webrtc-ice", ({ to, candidate }) => {
    io.to(String(to)).emit("webrtc-ice", {
      from: socket.id,
      candidate
    });
  });

  
  socket.on("presence:set", ({ status }, callback) => {
    const account = (socket.data as any).account;
    if (!account) return callback?.({ ok: false, error: "Oturum gerekli." });
    const allowed = ["online", "idle", "dnd", "invisible"];
    const value = allowed.includes(status) ? status : "online";
    accountPresence.set(account.id, value);
    io.emit("presence:changed", { accountId: account.id, status: value });
    callback?.({ ok: true, status: value });
  });

  socket.on("presence:get", ({ accountIds }, callback) => {
    const presence: Record<string,string> = {};
    for (const id of (accountIds || [])) presence[id] = accountPresence.get(id) || "offline";
    callback?.({ ok: true, presence });
  });

  socket.on("dm:typing", ({ friendId, typing }) => {
    const account = (socket.data as any).account;
    if (!account || !friendId) return;
    for (const peer of io.sockets.sockets.values()) {
      if ((peer.data as any).account?.id === friendId) {
        peer.emit("dm:typing", { accountId: account.id, typing: !!typing });
      }
    }
  });

  socket.on("dm:read", ({ friendId }, callback) => {
    const account = (socket.data as any).account;
    if (!account || !friendId) return callback?.({ ok:false });
    dmReadAt.set(`${account.id}:${friendId}`, Date.now());
    callback?.({ ok:true });
  });

  socket.on("dm:react", ({ messageId, emoji }, callback) => {
    const account = (socket.data as any).account;
    if (!account || !messageId || !emoji) return callback?.({ ok:false });
    const current = dmReactions.get(messageId) || {};
    const set = new Set(current[emoji] || []);
    set.has(account.id) ? set.delete(account.id) : set.add(account.id);
    current[emoji] = [...set];
    dmReactions.set(messageId, current);
    io.emit("dm:reaction", { messageId, reactions: current });
    callback?.({ ok:true, reactions: current });
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
        socketId: socket.id
      });

      users.delete(socket.id);
      broadcastPresence(oldRoom);
    } else {
      users.delete(socket.id);
    }
  });
});

const PORT = Number(process.env.PORT || 3001);

initDatabase()
  .then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`EchoVerse Server v1.6.1 listening on ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Database init failed", err);
    process.exit(1);
  });
