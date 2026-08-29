/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import {
  socketEventPayloadSchemas,
  webrtcDescriptionSchema,
  webrtcIceCandidateSchema
} from "@echoverse/contracts";
import crypto from "node:crypto";
import type { CallSession, User } from "../../domain/types.js";

const MAX_PENDING_CALLS = 1_024;

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type CallHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  pendingCalls: Map<string, CallSession & { timer: ReturnType<typeof setTimeout> }>;
  activeCalls: Map<string, CallSession>;
  socketForAccount(accountId: string): User | undefined;
  areFriends(a: string, b: string): Promise<boolean>;
  allowSocketEvent(socketId: string, event: string, limit: number): boolean;
  socketError(socket: any, key: string): string;
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerCallHandlers({
  socket,
  io,
  users,
  pendingCalls,
  activeCalls,
  socketForAccount,
  areFriends,
  allowSocketEvent,
  socketError,
  onValidatedSocketEvent
}: CallHandlerDependencies) {
  onValidatedSocketEvent(socket, "call:start", async ({ friendId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");

    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: socketError(socket, "server.callRequiresFriend") });
      return;
    }

    const friendSocket = socketForAccount(friend);
    if (!friendSocket) {
      callback?.({ ok: false, error: socketError(socket, "server.userOffline") });
      return;
    }

    const hasExistingCall = [...pendingCalls.values(), ...activeCalls.values()].some(
      (candidate) =>
        (candidate.callerAccountId === user.accountId && candidate.targetAccountId === friend) ||
        (candidate.callerAccountId === friend && candidate.targetAccountId === user.accountId)
    );
    if (hasExistingCall) {
      callback?.({ ok: false, error: socketError(socket, "call.alreadyActive") });
      return;
    }
    if (pendingCalls.size >= MAX_PENDING_CALLS) {
      callback?.({ ok: false, error: socketError(socket, "server.tooManyRequests") });
      return;
    }

    const callId = crypto.randomUUID();
    const call: CallSession = {
      callId,
      callerAccountId: user.accountId,
      callerSocketId: socket.id,
      targetAccountId: friend,
      targetSocketId: friendSocket.socketId
    };
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

    pendingCalls.set(callId, { ...call, timer: callTimer });

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

  onValidatedSocketEvent(socket, "call:answer", async ({ callId, toSocketId, accept }) => {
    const user = users.get(socket.id);
    if (!user?.accountId) return;

    const pending = pendingCalls.get(String(callId));
    if (
      !pending ||
      pending.targetAccountId !== user.accountId ||
      pending.targetSocketId !== socket.id ||
      pending.callerSocketId !== String(toSocketId) ||
      !(await areFriends(pending.callerAccountId, user.accountId))
    )
      return;

    clearTimeout(pending.timer);
    pendingCalls.delete(String(callId));
    if (accept) activeCalls.set(String(callId), pending);

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
    const id = String(callId);
    const pending = pendingCalls.get(id);
    const active = activeCalls.get(id);
    const call = pending || active;
    const user = users.get(socket.id);
    if (
      !call ||
      !user?.accountId ||
      ![call.callerSocketId, call.targetSocketId].includes(socket.id) ||
      ![call.callerSocketId, call.targetSocketId].includes(String(toSocketId)) ||
      String(toSocketId) === socket.id
    )
      return;

    if (pending) {
      clearTimeout(pending.timer);
      pendingCalls.delete(id);
    }
    activeCalls.delete(id);
    io.to(String(toSocketId)).emit("call:ended", { callId });
  });

  onValidatedSocketEvent(socket, "webrtc-offer", async (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 120)) return;
    const parsed = webrtcDescriptionSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, sdp } = parsed.data;
    if (!(await canRelaySignal(socket.id, String(to)))) return;
    io.to(String(to)).emit("webrtc-offer", { from: socket.id, sdp });
  });

  onValidatedSocketEvent(socket, "webrtc-answer", async (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 120)) return;
    const parsed = webrtcDescriptionSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, sdp } = parsed.data;
    if (!(await canRelaySignal(socket.id, String(to)))) return;
    io.to(String(to)).emit("webrtc-answer", { from: socket.id, sdp });
  });

  onValidatedSocketEvent(socket, "webrtc-ice", async (payload) => {
    if (!allowSocketEvent(socket.id, "webrtc", 240)) return;
    const parsed = webrtcIceCandidateSchema.safeParse(payload);
    if (!parsed.success) return;
    const { to, candidate } = parsed.data;
    if (!(await canRelaySignal(socket.id, String(to)))) return;
    io.to(String(to)).emit("webrtc-ice", { from: socket.id, candidate });
  });

  async function canRelaySignal(fromSocketId: string, toSocketId: string) {
    const call = [...activeCalls.values()].find(
      (candidate) =>
        (candidate.callerSocketId === fromSocketId && candidate.targetSocketId === toSocketId) ||
        (candidate.targetSocketId === fromSocketId && candidate.callerSocketId === toSocketId)
    );
    if (call) return await areFriends(call.callerAccountId, call.targetAccountId);

    // Guild voice uses the same WebRTC signaling transport as private calls,
    // but its authorization boundary is the shared lobby rather than a
    // friendship record. Only authenticated sockets currently in the exact
    // same voice room may exchange guild signaling messages.
    const sender = users.get(fromSocketId);
    const recipient = users.get(toSocketId);
    return Boolean(sender?.roomId && sender.roomId === recipient?.roomId);
  }

  function endCallsForSocket(socketId: string) {
    for (const [callId, pending] of pendingCalls) {
      if (pending.callerSocketId !== socketId && pending.targetSocketId !== socketId) continue;
      clearTimeout(pending.timer);
      pendingCalls.delete(callId);
    }
    for (const [callId, call] of activeCalls) {
      if (call.callerSocketId !== socketId && call.targetSocketId !== socketId) continue;
      activeCalls.delete(callId);
      const otherSocketId =
        call.callerSocketId === socketId ? call.targetSocketId : call.callerSocketId;
      io.to(otherSocketId).emit("call:ended", { callId });
    }
  }

  return { endCallsForSocket };
}
