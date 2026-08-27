/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Socket } from "socket.io-client";
import type { DmMessage, FriendUser } from "@echoverse/contracts";

type StateSetter<T> = (value: T | ((previous: T) => T)) => void;

export type FriendsFeatureDeps = {
  getSocket: () => Socket | null;
  getSearch: () => string;
  getActiveFriend: () => FriendUser | null;
  getTypingTimer: () => number | null;
  setTypingTimer: (timer: number | null) => void;
  setError: (message: string) => void;
  setFriends: StateSetter<FriendUser[]>;
  setIncomingRequests: StateSetter<FriendUser[]>;
  setOutgoingRequests: StateSetter<FriendUser[]>;
  setFriendSearch: (value: string) => void;
  setFriendSearchResults: StateSetter<FriendUser[]>;
  setActiveFriend: (friend: FriendUser | null) => void;
  setViewMode: (mode: "server" | "dm") => void;
  setShowFriends: (visible: boolean) => void;
  setDmMessages: StateSetter<DmMessage[]>;
  setDmText: (value: string) => void;
  setReplyTo: (message: DmMessage | null) => void;
  setUnreadDm: StateSetter<Record<string, number>>;
  translate: (key: string) => string;
  markDmRead: (unread: Record<string, number>, accountId: string) => Record<string, number>;
};

export function createFriendsFeature(deps: FriendsFeatureDeps) {
  function loadFriends(socket = deps.getSocket()) {
    if (!socket) return;

    socket.emit("friends:list", {}, (result: any) => {
      if (!result?.ok) return;
      deps.setFriends(result.accepted || []);
      deps.setIncomingRequests(result.incoming || []);
      deps.setOutgoingRequests(result.outgoing || []);
    });
  }

  function searchFriends() {
    const socket = deps.getSocket();
    const query = deps.getSearch().trim();
    if (!socket || !query) {
      deps.setFriendSearchResults([]);
      return;
    }

    socket.emit("friends:search", { query }, (result: any) => {
      if (result?.ok) deps.setFriendSearchResults(result.results || []);
    });
  }

  function sendFriendRequest(targetId: string) {
    const socket = deps.getSocket();
    socket?.emit("friends:request", { targetId }, (result: any) => {
      if (!result?.ok) {
        deps.setError(result?.error || deps.translate("error.requestFailed"));
        return;
      }
      deps.setFriendSearchResults([]);
      deps.setFriendSearch("");
      loadFriends();
    });
  }

  function respondFriendRequest(friendshipId: string, accept: boolean) {
    const socket = deps.getSocket();
    socket?.emit("friends:respond", { friendshipId, accept }, (result: any) => {
      if (!result?.ok) {
        deps.setError(result?.error || deps.translate("error.requestFailed"));
        return;
      }
      loadFriends();
    });
  }

  function removeFriend(targetId: string) {
    const socket = deps.getSocket();
    socket?.emit("friends:remove", { targetId }, () => {
      loadFriends();
      if (deps.getActiveFriend()?.id === targetId) {
        deps.setActiveFriend(null);
        deps.setDmMessages([]);
      }
    });
  }

  function openDm(friend: FriendUser) {
    const socket = deps.getSocket();
    const typingTimer = deps.getTypingTimer();
    if (typingTimer !== null) {
      window.clearTimeout(typingTimer);
      deps.setTypingTimer(null);
    }

    const previousFriend = deps.getActiveFriend();
    if (previousFriend) {
      socket?.emit("dm:typing", { friendId: previousFriend.id, typing: false });
    }

    deps.setActiveFriend(friend);
    deps.setViewMode("dm");
    deps.setShowFriends(false);
    deps.setDmMessages([]);
    deps.setDmText("");
    deps.setReplyTo(null);
    deps.setUnreadDm((previous) => deps.markDmRead(previous, friend.id));

    socket?.emit("dm:history", { friendId: friend.id }, (result: any) => {
      if (result?.ok) deps.setDmMessages(result.messages || []);
    });
  }

  return {
    loadFriends,
    searchFriends,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    openDm
  };
}
