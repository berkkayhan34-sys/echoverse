/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DmMessage, FriendUser } from "@echoverse/contracts";

/**
 * Applies a DM delivery event without allowing Socket.IO replay or reconnect
 * delivery to duplicate a message already rendered by the client.
 */
export function appendDmMessage(messages: DmMessage[], message: DmMessage): DmMessage[] {
  if (messages.some((current) => current.id === message.id)) return messages;
  return [...messages, message];
}

/** Applies the server's canonical representation of an edited DM. */
export function updateDmMessage(messages: DmMessage[], message: DmMessage): DmMessage[] {
  return messages.map((current) =>
    current.id === message.id ? { ...current, ...message } : current
  );
}

/** Applies reactions without replacing unrelated message fields. */
export function applyDmReaction(
  messages: DmMessage[],
  messageId: string,
  reactions: Record<string, string[]>
): DmMessage[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, reactions } : message
  );
}

/**
 * Replaces user-visible content and attachment data after a server-side
 * deletion while preserving the message identity and deletion timestamp.
 */
export function deleteDmMessage(
  messages: DmMessage[],
  messageId: string,
  deletedAt: string | null | undefined
): DmMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          body: "",
          deletedAt,
          attachmentName: null,
          attachmentMime: null,
          attachmentData: null
        }
      : message
  );
}

/** Applies a presence event to the matching friend only. */
export function updateFriendPresence(
  friends: FriendUser[],
  accountId: string,
  status: FriendUser["status"]
): FriendUser[] {
  return friends.map((friend) => (friend.id === accountId ? { ...friend, status } : friend));
}

/** Applies a typing event while retaining unrelated conversations. */
export function updateTypingState(
  state: Record<string, boolean>,
  accountId: string,
  typing: boolean
): Record<string, boolean> {
  return { ...state, [accountId]: typing };
}
