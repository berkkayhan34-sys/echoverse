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
};

export type Guild = { id: string; name: string; createdBy: string; createdAt: string };

export type SpotifyPartyState = {
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
