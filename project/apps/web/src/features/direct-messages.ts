/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Socket } from "socket.io-client";
import type { Account, DmMessage, FriendUser } from "@echoverse/contracts";

type Attachment = { name: string; mime: string; data: string };

export type DirectMessagesFeatureDeps = {
  getSocket: () => Socket | null;
  getFriend: () => FriendUser | null;
  getAccount: () => Account | null;
  getText: () => string;
  getEditing: () => DmMessage | null;
  getAttachment: () => Attachment | null;
  getReply: () => DmMessage | null;
  getTypingTimer: () => number | null;
  setTypingTimer: (timer: number | null) => void;
  setText: (value: string) => void;
  setAttachment: (value: Attachment | null) => void;
  setReply: (value: DmMessage | null) => void;
  setEditing: (value: DmMessage | null) => void;
  setError: (message: string) => void;
  translate: (key: string) => string;
  confirmDelete: (message: string) => boolean;
};

export function createDirectMessagesFeature(deps: DirectMessagesFeatureDeps) {
  function sendDm() {
    const socket = deps.getSocket();
    const friend = deps.getFriend();
    if (!socket || !friend) return;

    const body = deps.getText().trim();
    const editing = deps.getEditing();
    if (editing) {
      if (!body) return;
      socket.emit("dm:edit", { messageId: editing.id, body }, (result: any) => {
        if (!result?.ok) deps.setError(result?.error || deps.translate("chat.editFailed"));
      });
      deps.setEditing(null);
      deps.setText("");
      return;
    }

    const attachment = deps.getAttachment();
    if (!body && !attachment) return;

    const replyToId = deps.getReply()?.id || null;
    deps.setText("");
    deps.setAttachment(null);
    deps.setReply(null);
    socket.emit("dm:typing", { friendId: friend.id, typing: false });
    socket.emit("dm:send", { friendId: friend.id, body, replyToId, attachment }, (result: any) => {
      if (!result?.ok) deps.setError(result?.error || deps.translate("chat.sendFailed"));
    });
  }

  function editDm(message: DmMessage) {
    if (message.senderId !== deps.getAccount()?.id || message.deletedAt) return;
    deps.setEditing(message);
    deps.setReply(null);
    deps.setAttachment(null);
    deps.setText(message.body);
  }

  function deleteDm(message: DmMessage) {
    const socket = deps.getSocket();
    if (!socket || message.senderId !== deps.getAccount()?.id || message.deletedAt) return;
    if (!deps.confirmDelete(deps.translate("chat.deleteConfirm"))) return;

    socket.emit("dm:delete", { messageId: message.id }, (result: any) => {
      if (!result?.ok) deps.setError(result?.error || deps.translate("chat.deleteFailed"));
    });
  }

  function sendTyping(typing: boolean) {
    const socket = deps.getSocket();
    const friend = deps.getFriend();
    if (!friend || !socket) return;

    socket.emit("dm:typing", { friendId: friend.id, typing });
    const previousTimer = deps.getTypingTimer();
    if (previousTimer !== null) {
      window.clearTimeout(previousTimer);
      deps.setTypingTimer(null);
    }

    if (typing) {
      const timer = window.setTimeout(() => {
        socket.emit("dm:typing", { friendId: friend.id, typing: false });
        deps.setTypingTimer(null);
      }, 1400);
      deps.setTypingTimer(timer);
    }
  }

  function reactDm(messageId: string, emoji: string) {
    deps.getSocket()?.emit("dm:react", { messageId, emoji });
  }

  return { sendDm, editDm, deleteDm, sendTyping, reactDm };
}
