import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import { Server } from "socket.io";

const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "EchoVerse Server",
    ok: true,
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

type User = {
  socketId: string;
  userId: string;
  username: string;
  roomId?: string;
};

const users = new Map<string, User>();

function sanitizeName(value: unknown) {
  const s = String(value ?? "").trim().slice(0, 28);
  return s || "Guest";
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().slice(0, 2500);
}

function getPresence(roomId: string) {
  return [...users.values()]
    .filter(u => u.roomId === roomId)
    .map(u => ({
      socketId: u.socketId,
      userId: u.userId,
      username: u.username
    }));
}

function broadcastPresence(roomId: string) {
  io.to(roomId).emit("presence", getPresence(roomId));
}

io.on("connection", socket => {
  socket.on("identify", ({ userId, username }) => {
    users.set(socket.id, {
      socketId: socket.id,
      userId: String(userId || crypto.randomUUID()),
      username: sanitizeName(username)
    });
  });

  socket.on("join-room", ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const nextRoom = String(roomId || "lobby").slice(0, 64);

    if (user.roomId) {
      socket.leave(user.roomId);
      socket.to(user.roomId).emit("peer-left", { socketId: socket.id });
      broadcastPresence(user.roomId);
    }

    user.roomId = nextRoom;
    users.set(socket.id, user);

    socket.join(nextRoom);

    const peers = getPresence(nextRoom)
      .filter(p => p.socketId !== socket.id);

    socket.emit("room-peers", peers);

    socket.to(nextRoom).emit("peer-joined", {
      socketId: socket.id,
      userId: user.userId,
      username: user.username
    });

    broadcastPresence(nextRoom);
  });

  socket.on("chat-message", ({ roomId, text }) => {
    const user = users.get(socket.id);
    if (!user || user.roomId !== roomId) return;

    const safeText = sanitizeText(text);
    if (!safeText) return;

    const msg = {
      id: crypto.randomUUID(),
      roomId,
      userId: user.userId,
      username: user.username,
      text: safeText,
      createdAt: new Date().toISOString()
    };

    io.to(roomId).emit("chat-message", msg);

    const cmd = safeText.toLowerCase();

    if (cmd === "!ping") {
      io.to(roomId).emit("chat-message", {
        id: crypto.randomUUID(),
        roomId,
        userId: "bot:utility",
        username: "EchoBot",
        text: "Pong 🏓",
        bot: true,
        createdAt: new Date().toISOString()
      });
    }

    if (cmd === "!roll") {
      io.to(roomId).emit("chat-message", {
        id: crypto.randomUUID(),
        roomId,
        userId: "bot:utility",
        username: "EchoBot",
        text: `🎲 ${Math.floor(Math.random() * 100) + 1}`,
        bot: true,
        createdAt: new Date().toISOString()
      });
    }

    if (cmd === "!help") {
      io.to(roomId).emit("chat-message", {
        id: crypto.randomUUID(),
        roomId,
        userId: "bot:utility",
        username: "EchoBot",
        text: "Komutlar: !ping, !roll, !help",
        bot: true,
        createdAt: new Date().toISOString()
      });
    }
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

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user?.roomId) {
      const room = user.roomId;
      socket.to(room).emit("peer-left", { socketId: socket.id });
      users.delete(socket.id);
      broadcastPresence(room);
    } else {
      users.delete(socket.id);
    }
  });
});

const PORT = Number(process.env.PORT || 3001);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`EchoVerse Server listening on ${PORT}`);
});
