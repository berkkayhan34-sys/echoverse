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

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Counts user-perceived characters rather than UTF-16 code units. This keeps
 * validation and truncation from splitting combining sequences or emoji.
 */
export function graphemeLength(value: string) {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export function truncateGraphemes(value: string, max: number) {
  return Array.from(graphemeSegmenter.segment(value))
    .slice(0, max)
    .map(({ segment }) => segment)
    .join("");
}

const usernameCharacterPattern =
  /^(?:[\p{L}\p{N}\p{M}_.-]|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200D)+$/u;

export const registerCredentialsSchema = authCredentialsSchema.extend({
  username: z
    .string()
    .trim()
    .regex(usernameCharacterPattern)
    .refine((value) => graphemeLength(value) >= 3 && graphemeLength(value) <= 28)
});

export const attachmentMimeSchema = z.enum([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/json",
  "application/pdf",
  "application/zip"
]);

const attachmentShape = z.object({
  name: z.string().trim().min(1).max(180),
  mime: attachmentMimeSchema,
  data: z
    .string()
    .regex(/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i)
    .max(5_700_000)
});

export const attachmentSchema = attachmentShape.superRefine((value, context) => {
  const declaredMime = value.data.slice(5, value.data.indexOf(";"));
  if (declaredMime.toLowerCase() !== value.mime) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["data"], message: "MIME mismatch" });
  }
});

export const attachmentMetadataSchema = attachmentShape.pick({ name: true, mime: true }).strict();

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

const identifierSchema = z.string().trim().min(1).max(128);
const optionalEmptyPayloadSchema = z.union([z.undefined(), z.null(), z.object({}).strict()]);

export const socketEventPayloadSchemas = {
  "auth:register": registerCredentialsSchema,
  "auth:login": authCredentialsSchema,
  "auth:resume": z
    .object({
      token: z.string().max(4096).optional(),
      refreshToken: z.string().max(4096).optional()
    })
    .strict(),
  "auth:logout": z.object({ token: z.string().max(4096).optional() }).strict(),
  "profile:set-avatar": z
    .object({
      token: z.string().max(4096).optional(),
      avatarData: z
        .string()
        .regex(/^data:image\/(?:png|jpeg|webp);base64,/i)
        .max(700_000)
        .nullable()
        .optional()
    })
    .strict(),
  identify: z
    .object({
      token: z.string().max(4096).optional(),
      userId: identifierSchema.optional(),
      username: z.string().trim().max(80).optional()
    })
    .strict(),
  "friends:search": z.object({ query: z.string().trim().max(40) }).strict(),
  "friends:list": optionalEmptyPayloadSchema,
  "friends:request": z.object({ targetId: identifierSchema }).strict(),
  "friends:respond": z.object({ friendshipId: identifierSchema, accept: z.boolean() }).strict(),
  "friends:remove": z.object({ targetId: identifierSchema }).strict(),
  "friends:block": z.object({ targetId: identifierSchema }).strict(),
  "friends:unblock": z.object({ targetId: identifierSchema }).strict(),
  "dm:history": z.object({ friendId: identifierSchema }).strict(),
  "dm:send": z
    .object({
      friendId: identifierSchema,
      body: z.string().max(2500),
      replyToId: identifierSchema.nullable().optional(),
      attachment: attachmentSchema.nullable().optional()
    })
    .strict(),
  "dm:edit": z.object({ messageId: identifierSchema, body: z.string().max(2500) }).strict(),
  "dm:delete": z.object({ messageId: identifierSchema }).strict(),
  "call:start": z.object({ friendId: identifierSchema }).strict(),
  "call:answer": z
    .object({ callId: identifierSchema, toSocketId: identifierSchema, accept: z.boolean() })
    .strict(),
  "call:end": z.object({ toSocketId: identifierSchema, callId: identifierSchema }).strict(),
  "guild:create": z.object({ name: z.string().trim().min(1).max(32) }).strict(),
  "guild:join-code": z.object({ code: z.string().trim().min(1).max(80) }).strict(),
  "join-room": z.object({ guildId: z.string().trim().min(1).max(80) }).strict(),
  "voice:sync-request": optionalEmptyPayloadSchema,
  "leave-room": optionalEmptyPayloadSchema,
  "chat-message": chatMessageSchema,
  "spotify:party-start": z.object({ guildId: identifierSchema }).strict(),
  "spotify:party-stop": z.object({ guildId: identifierSchema }).strict(),
  "spotify:sync": z
    .object({
      guildId: identifierSchema,
      state: z
        .object({
          trackUri: z.string().max(512).optional(),
          trackName: z.string().max(512).optional(),
          artistName: z.string().max(512).optional(),
          albumImage: z.union([z.literal(""), z.string().url().max(2048)]).optional(),
          positionMs: z.number().finite().min(0).max(86_400_000).optional(),
          isPlaying: z.boolean().optional(),
          timestamp: z.number().int().min(0).max(9_999_999_999_999).optional(),
          updatedAt: z.number().int().min(0).max(9_999_999_999_999).optional()
        })
        .strict()
    })
    .strict(),
  "webrtc-offer": webrtcDescriptionSchema,
  "webrtc-answer": webrtcDescriptionSchema,
  "webrtc-ice": webrtcIceCandidateSchema,
  "presence:set": z.object({ status: z.enum(["online", "idle", "dnd", "invisible"]) }).strict(),
  "presence:get": z.object({ accountIds: z.array(identifierSchema).max(100) }).strict(),
  "dm:typing": z.object({ friendId: identifierSchema, typing: z.boolean() }).strict(),
  "dm:read": z.object({ friendId: identifierSchema }).strict(),
  "dm:react": z
    .object({ messageId: identifierSchema, emoji: z.string().trim().min(1).max(12) })
    .strict()
} as const;

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

export * from "./localization.js";
