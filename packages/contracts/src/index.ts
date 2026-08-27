/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { z } from "zod";

export const PROTOCOL_VERSION = 2 as const;
export const supportedProtocolVersions = [PROTOCOL_VERSION] as const;

export const protocolVersionSchema = z.number().int().min(1).max(255);

export function isSupportedProtocolVersion(value: unknown): value is typeof PROTOCOL_VERSION {
  return value === PROTOCOL_VERSION;
}

export type ProtocolEnvelope<T> = {
  v: typeof PROTOCOL_VERSION;
  id: string;
  event: string;
  payload: T;
  sentAt: string;
};

export const protocolEnvelopeSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string().uuid(),
    event: z.string().min(1).max(80),
    payload: z.unknown(),
    sentAt: z.string().datetime()
  })
  .strict();

export const protocolReadySchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION)
  })
  .strict();

export const safeErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().trim().min(1).max(240)
  })
  .strict();

export const paginationSchema = z
  .object({
    cursor: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(100).default(50)
  })
  .strict();

export function createEnvelope<T>(
  event: string,
  payload: T,
  id = crypto.randomUUID()
): ProtocolEnvelope<T> {
  return {
    v: PROTOCOL_VERSION,
    id,
    event,
    payload,
    sentAt: new Date().toISOString()
  };
}

export const authCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(6).max(256)
});

export const registerCredentialsSchema = authCredentialsSchema.extend({
  username: z
    .string()
    .trim()
    .min(3)
    .max(28)
    .regex(/^[\p{L}\p{N}_.-]+$/u)
});

export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mime: z.string().trim().min(1).max(120),
  data: z
    .string()
    .regex(/^data:[^;]+;base64,/)
    .max(5_700_000)
});

export const attachmentMetadataSchema = attachmentSchema.pick({ name: true, mime: true }).strict();

export const chatMessageSchema = z.object({
  guildId: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(2500)
});

const peerSocketIdSchema = z.string().trim().min(1).max(128);
const sessionDescriptionSchema = z
  .object({
    type: z.enum(["offer", "answer", "pranswer", "rollback"]),
    sdp: z.string().min(1).max(200_000)
  })
  .strict();

export const webrtcDescriptionSchema = z
  .object({
    to: peerSocketIdSchema,
    sdp: sessionDescriptionSchema
  })
  .strict();

export const webrtcDescriptionEventSchema = z
  .object({
    from: peerSocketIdSchema,
    sdp: sessionDescriptionSchema
  })
  .strict();

export const webrtcIceCandidateSchema = z
  .object({
    to: peerSocketIdSchema,
    candidate: z
      .object({
        candidate: z.string().min(1).max(10_000),
        sdpMid: z.string().max(256).nullable().optional(),
        sdpMLineIndex: z.number().int().min(0).max(255).nullable().optional(),
        usernameFragment: z.string().max(256).nullable().optional()
      })
      .strict()
  })
  .strict();

export const webrtcIceCandidateEventSchema = z
  .object({
    from: peerSocketIdSchema,
    candidate: webrtcIceCandidateSchema.shape.candidate
  })
  .strict();

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type RegisterCredentials = z.infer<typeof registerCredentialsSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;

export type PeerInfo = {
  socketId: string;
  userId: string;
  username: string;
  avatarData?: string | null;
};
export type Account = { id: string; email: string; username: string; avatarData?: string | null };
export type FriendUser = {
  id: string;
  username: string;
  avatarData?: string | null;
  friendshipId?: string;
  status?: "online" | "idle" | "dnd" | "invisible" | "offline";
};
export type DmMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  senderUsername?: string;
  senderAvatarData?: string | null;
  replyToId?: string | null;
  editedAt?: string;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentData?: string | null;
  reactions?: Record<string, string[]>;
  deletedAt?: string | null;
};
export type IncomingCall = {
  callId: string;
  fromAccountId: string;
  fromSocketId: string;
  fromUsername: string;
  fromAvatarData?: string | null;
};
export type ChatMessage = {
  id: string;
  username: string;
  avatarData?: string | null;
  text: string;
  createdAt: string;
  bot?: boolean;
};
export type Guild = { id: string; name: string; createdBy: string; createdAt: string };
export type ScreenSource = { id: string; name: string; thumbnail?: string; appIcon?: string };
export type SpotifyState = {
  guildId?: string;
  leaderSocketId?: string;
  leaderUsername?: string;
  active?: boolean;
  trackUri?: string;
  trackName?: string;
  artistName?: string;
  albumImage?: string;
  positionMs?: number;
  isPlaying?: boolean;
  updatedAt?: number;
};
