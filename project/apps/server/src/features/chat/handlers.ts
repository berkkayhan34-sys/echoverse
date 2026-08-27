/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import { chatMessageSchema, type Locale, socketEventPayloadSchemas } from "@echoverse/contracts";
import type { User } from "../../domain/types.js";
import { sanitizeText } from "../../domain/validation.js";
import { utilityBotResponse } from "./commands.js";

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type ChatHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  resolveRequestLocale(value: unknown): Locale;
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerChatHandlers({
  socket,
  io,
  users,
  resolveRequestLocale,
  onValidatedSocketEvent
}: ChatHandlerDependencies) {
  onValidatedSocketEvent(socket, "chat-message", (payload) => {
    const user = users.get(socket.id);
    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) return;
    const { guildId, text } = parsed.data;
    if (!user || !user.roomId || user.guildId !== guildId) return;

    const safeText = sanitizeText(text);
    if (!safeText) return;

    const message = {
      id: crypto.randomUUID(),
      guildId,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData,
      text: safeText,
      createdAt: new Date().toISOString()
    };

    io.to(user.roomId).emit("chat-message", message);

    const botText = utilityBotResponse(
      safeText.toLowerCase(),
      resolveRequestLocale(socket.data.locale)
    );
    if (!botText) return;

    io.to(user.roomId).emit("chat-message", {
      id: crypto.randomUUID(),
      guildId,
      userId: "bot:utility",
      username: "EchoBot",
      avatarData: null,
      text: botText,
      bot: true,
      createdAt: new Date().toISOString()
    });
  });
}
