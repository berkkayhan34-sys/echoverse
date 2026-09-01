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

const identifierSchema = z.string().trim().min(1).max(128);

export const chatMessageSchema = z.object({
  guildId: z.string().min(1).max(80),
  text: z.string().trim().min(1).max(2500),
  channelId: z.string().trim().min(1).max(128).optional(),
  replyToId: identifierSchema.nullable().optional()
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
  "friends:cancel": z.object({ friendshipId: identifierSchema }).strict(),
  "friends:remove": z.object({ targetId: identifierSchema }).strict(),
  "friends:block": z.object({ targetId: identifierSchema }).strict(),
  "friends:unblock": z.object({ targetId: identifierSchema }).strict(),
  "dm:history": z
    .object({ friendId: identifierSchema.optional(), conversationId: identifierSchema.optional() })
    .strict()
    .refine((value) => Boolean(value.friendId) !== Boolean(value.conversationId)),
  "dm:send": z
    .object({
      friendId: identifierSchema.optional(),
      conversationId: identifierSchema.optional(),
      body: z.string().max(2500),
      replyToId: identifierSchema.nullable().optional(),
      attachment: attachmentSchema.nullable().optional()
    })
    .strict()
    .refine((value) => Boolean(value.friendId) !== Boolean(value.conversationId)),
  "dm:requests": optionalEmptyPayloadSchema,
  "dm:request-respond": z
    .object({
      requestId: identifierSchema,
      action: z.enum(["accept", "decline", "spam"])
    })
    .strict(),
  "dm:edit": z.object({ messageId: identifierSchema, body: z.string().max(2500) }).strict(),
  "dm:delete": z.object({ messageId: identifierSchema }).strict(),
  "call:start": z
    .object({ friendId: identifierSchema.optional(), conversationId: identifierSchema.optional() })
    .strict()
    .refine((value) => Boolean(value.friendId) !== Boolean(value.conversationId)),
  "call:answer": z
    .object({ callId: identifierSchema, toSocketId: identifierSchema, accept: z.boolean() })
    .strict(),
  "call:end": z.object({ toSocketId: identifierSchema, callId: identifierSchema }).strict(),
  "guild:create": z.object({ name: z.string().trim().min(1).max(32) }).strict(),
  "guild:join-code": z.object({ code: z.string().trim().min(1).max(128) }).strict(),
  "guild:create-invite": z
    .object({
      guildId: identifierSchema,
      expiresInHours: z.number().int().min(1).max(720).optional()
    })
    .strict(),
  "guild:revoke-invite": z
    .object({ guildId: identifierSchema, token: z.string().trim().min(1).max(128) })
    .strict(),
  "guild:set-role": z
    .object({
      guildId: identifierSchema,
      accountId: identifierSchema,
      role: z.enum(["admin", "moderator", "member"])
    })
    .strict(),
  "guild:rename-lobby": z
    .object({ guildId: identifierSchema, name: z.string().trim().min(1).max(32) })
    .strict(),
  "guild:channels": z.object({ guildId: identifierSchema }).strict(),
  "guild:create-channel": z
    .object({
      guildId: identifierSchema,
      name: z.string().trim().min(1).max(64),
      type: z.enum(["text", "voice", "stage", "forum"]),
      categoryId: identifierSchema.nullable().optional()
    })
    .strict(),
  "guild:update-channel": z
    .object({
      guildId: identifierSchema,
      channelId: identifierSchema,
      name: z.string().trim().min(1).max(64).optional(),
      archived: z.boolean().optional()
    })
    .strict(),
  "guild:categories": z.object({ guildId: identifierSchema }).strict(),
  "guild:create-category": z
    .object({ guildId: identifierSchema, name: z.string().trim().min(1).max(64) })
    .strict(),
  "guild:update-category": z
    .object({
      guildId: identifierSchema,
      categoryId: identifierSchema,
      name: z.string().trim().min(1).max(64).optional(),
      archived: z.boolean().optional()
    })
    .strict(),
  "guild:reorder-categories": z
    .object({ guildId: identifierSchema, categoryIds: z.array(identifierSchema).min(1).max(100) })
    .strict(),
  "guild:reorder-channels": z
    .object({ guildId: identifierSchema, channelIds: z.array(identifierSchema).min(1).max(200) })
    .strict(),
  "guild:set-permission-override": z
    .object({
      guildId: identifierSchema,
      scopeType: z.enum(["guild", "category", "channel"]),
      scopeId: identifierSchema,
      role: z.enum(["owner", "admin", "moderator", "member"]),
      permission: z.string().trim().min(1).max(64),
      allowed: z.boolean()
    })
    .strict(),
  "guild:members": z.object({ guildId: identifierSchema }).strict(),
  "guild:moderate-member": z
    .object({
      guildId: identifierSchema,
      accountId: identifierSchema,
      action: z.enum(["kick", "ban", "timeout", "unban"]),
      durationMinutes: z.number().int().min(1).max(43_200).optional(),
      reason: z.string().trim().max(500).optional()
    })
    .strict(),
  "guild:report-member": z
    .object({
      guildId: identifierSchema,
      accountId: identifierSchema,
      reason: z.string().trim().min(1).max(500)
    })
    .strict(),
  "guild:reports": z
    .object({ guildId: identifierSchema, limit: z.number().int().min(1).max(100).optional() })
    .strict(),
  "guild:audit": z
    .object({ guildId: identifierSchema, limit: z.number().int().min(1).max(100).optional() })
    .strict(),
  "guild:leave": z.object({ guildId: identifierSchema }).strict(),
  "guild:delete": z.object({ guildId: identifierSchema }).strict(),
  "guild:select": z.object({ guildId: identifierSchema }).strict(),
  "guild:notification-state": z.object({ guildId: identifierSchema }).strict(),
  "guild:set-notification-preference": z
    .object({
      guildId: identifierSchema,
      channelId: identifierSchema,
      level: z.enum(["all", "none"])
    })
    .strict(),
  "guild:mark-channel-read": z
    .object({ guildId: identifierSchema, channelId: identifierSchema })
    .strict(),
  "join-room": z.object({ guildId: z.string().trim().min(1).max(80) }).strict(),
  "voice:sync-request": optionalEmptyPayloadSchema,
  "leave-room": optionalEmptyPayloadSchema,
  "chat-message": chatMessageSchema,
  "chat-history": z
    .object({
      guildId: identifierSchema,
      channelId: identifierSchema,
      limit: z.number().int().min(1).max(100).optional()
    })
    .strict(),
  "chat-search": z
    .object({
      guildId: identifierSchema,
      channelId: identifierSchema,
      query: z.string().trim().min(1).max(100),
      authorId: identifierSchema.optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      before: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).optional()
    })
    .strict(),
  "chat-edit": z
    .object({
      guildId: identifierSchema,
      messageId: identifierSchema,
      body: z.string().trim().min(1).max(2500)
    })
    .strict(),
  "chat-delete": z.object({ guildId: identifierSchema, messageId: identifierSchema }).strict(),
  "chat-pin": z
    .object({ guildId: identifierSchema, messageId: identifierSchema, pinned: z.boolean() })
    .strict(),
  "chat-react": z
    .object({
      guildId: identifierSchema,
      messageId: identifierSchema,
      emoji: z.string().trim().min(1).max(12)
    })
    .strict(),
  "webrtc-offer": webrtcDescriptionSchema,
  "webrtc-answer": webrtcDescriptionSchema,
  "webrtc-ice": webrtcIceCandidateSchema,
  "presence:set": z.object({ status: z.enum(["online", "idle", "dnd", "invisible"]) }).strict(),
  "presence:get": z.object({ accountIds: z.array(identifierSchema).max(100) }).strict(),
  "dm:typing": z
    .object({
      friendId: identifierSchema.optional(),
      conversationId: identifierSchema.optional(),
      typing: z.boolean()
    })
    .strict()
    .refine((value) => Boolean(value.friendId) !== Boolean(value.conversationId)),
  "dm:read": z.object({ friendId: identifierSchema }).strict(),
  "dm:react": z
    .object({ messageId: identifierSchema, emoji: z.string().trim().min(1).max(12) })
    .strict(),
  "dm:conversations": optionalEmptyPayloadSchema,
  "dm-search": z
    .object({
      friendId: identifierSchema.optional(),
      conversationId: identifierSchema.optional(),
      query: z.string().trim().min(1).max(100),
      authorId: identifierSchema.optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      before: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).optional()
    })
    .strict()
    .refine((value) => Boolean(value.friendId) !== Boolean(value.conversationId)),
  "dm:group-create": z
    .object({
      memberIds: z.array(identifierSchema).min(1).max(9),
      name: z.string().trim().max(80).optional()
    })
    .strict(),
  "dm:group-add": z
    .object({ conversationId: identifierSchema, accountId: identifierSchema })
    .strict(),
  "dm:group-remove": z
    .object({ conversationId: identifierSchema, accountId: identifierSchema })
    .strict(),
  "dm:group-promote": z
    .object({ conversationId: identifierSchema, accountId: identifierSchema })
    .strict(),
  "dm:group-leave": z.object({ conversationId: identifierSchema }).strict()
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
  relationship?: "none" | "pending_incoming" | "pending_outgoing" | "friends" | "blocked";
};
export type DmMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  conversationId?: string | null;
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
export type DmRequest = {
  id: string;
  senderId: string;
  recipientId: string;
  senderUsername: string;
  senderAvatarData?: string | null;
  recipientUsername: string;
  recipientAvatarData?: string | null;
  body: string;
  status: "pending" | "accepted" | "declined" | "spam";
  createdAt: string;
  updatedAt: string;
};
export type DmConversationMember = {
  accountId: string;
  username: string;
  avatarData?: string | null;
  role: "owner" | "admin" | "member";
};
export type DmConversation = {
  id: string;
  kind: "direct" | "group";
  name?: string | null;
  createdBy: string;
  createdAt: string;
  members: DmConversationMember[];
};
export type IncomingCall = {
  callId: string;
  fromAccountId: string;
  fromSocketId: string;
  fromUsername: string;
  fromAvatarData?: string | null;
  conversationId?: string;
  groupCall?: boolean;
};
export type ChatMessage = {
  id: string;
  guildId?: string;
  channelId?: string;
  userId?: string;
  username: string;
  avatarData?: string | null;
  text: string;
  createdAt: string;
  bot?: boolean;
  replyToId?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinned?: boolean;
  reactions?: Record<string, string[]>;
};
export type GuildRole = "owner" | "admin" | "moderator" | "member";
export type GuildMember = {
  accountId: string;
  username: string;
  avatarData?: string | null;
  role: GuildRole;
};
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
export type GuildCategory = {
  id: string;
  guildId: string;
  name: string;
  position: number;
  archived: boolean;
  createdAt: string;
};
export type GuildNotificationLevel = "all" | "none";
export type GuildNotificationPreference = {
  channelId: string;
  level: GuildNotificationLevel;
};
export type GuildUnreadChannel = {
  channelId: string;
  unreadCount: number;
};
export type GuildNotificationState = {
  guildId: string;
  preferences: GuildNotificationPreference[];
  unread: GuildUnreadChannel[];
};
export type Guild = {
  id: string;
  name: string;
  lobbyName?: string;
  createdBy: string;
  ownerId?: string;
  createdAt: string;
  role?: GuildRole;
};
export type ScreenSource = { id: string; name: string; thumbnail?: string; appIcon?: string };
export * from "./localization.js";
