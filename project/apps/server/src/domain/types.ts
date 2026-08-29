/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type Account = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarData: string | null;
  createdAt: string;
};

export type PublicAccount = Pick<Account, "id" | "email" | "username" | "avatarData">;

export type User = {
  socketId: string;
  userId: string;
  username: string;
  avatarData: string | null;
  accountId?: string;
  roomId?: string;
  guildId?: string;
  activeGuildId?: string;
};

export type Guild = {
  id: string;
  name: string;
  lobbyName?: string;
  createdBy: string;
  ownerId?: string;
  createdAt: string;
};

export type GuildRole = "owner" | "admin" | "moderator" | "member";

export type GuildChannelType = "text" | "voice" | "stage" | "forum";

export type GuildChannel = {
  id: string;
  guildId: string;
  name: string;
  type: GuildChannelType;
  categoryId?: string | null;
  position: number;
  archived: boolean;
  createdAt: string;
};

export type GuildModerationAction = "kick" | "ban" | "timeout" | "unban";

export type StoredGuildMessage = {
  id: string;
  guildId: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinned?: boolean;
  reactions?: Record<string, string[]>;
};

export type CallSession = {
  callId: string;
  callerAccountId: string;
  callerSocketId: string;
  targetAccountId: string;
  targetSocketId: string;
};

export type StoredDm = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentData?: string | null;
  reactions?: Record<string, string[]>;
};
