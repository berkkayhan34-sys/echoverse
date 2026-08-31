/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DmConversation, FriendUser } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type DirectMessageInboxLabels = {
  title: string;
  searchPlaceholder: string;
  friends: string;
  groups: string;
  messageRequests: string;
  openFriends: string;
  noFriends: string;
  noConversations: string;
  memberCount: (count: number) => string;
  mentions: string;
};

function conversationTitle(conversation: DmConversation, accountId?: string) {
  return (
    conversation.name ||
    conversation.members
      .filter((member) => member.accountId !== accountId)
      .map((member) => member.username)
      .join(", ")
  );
}

/** Persistent, shared DM navigation used by the web and desktop renderers. */
export function DirectMessageInbox({
  friends,
  conversations,
  unread,
  searchQuery,
  currentAccountId,
  mentionCount = 0,
  labels,
  compact = false,
  onSearchQueryChange,
  onOpenFriends,
  onOpenDm,
  onOpenConversation
}: {
  friends: FriendUser[];
  conversations: DmConversation[];
  unread: Record<string, number>;
  searchQuery: string;
  currentAccountId?: string;
  mentionCount?: number;
  labels: DirectMessageInboxLabels;
  compact?: boolean;
  onSearchQueryChange: (value: string) => void;
  onOpenFriends: () => void;
  onOpenDm: (friend: FriendUser) => void;
  onOpenConversation: (conversation: DmConversation) => void;
}) {
  const query = searchQuery.trim().toLocaleLowerCase();
  const visibleFriends = friends.filter((friend) =>
    !query ? true : friend.username.toLocaleLowerCase().includes(query)
  );
  const visibleConversations = conversations.filter((conversation) =>
    !query
      ? true
      : conversationTitle(conversation, currentAccountId).toLocaleLowerCase().includes(query)
  );

  return (
    <section className={`dm-inbox ${compact ? "dm-inbox-compact" : ""}`} aria-label={labels.title}>
      <header className="dm-inbox-header">
        <div>
          <h2>{labels.title}</h2>
          {!compact && <p>{labels.friends}</p>}
        </div>
        <button className="dm-inbox-friends-button" type="button" onClick={onOpenFriends}>
          ＋ {labels.openFriends}
        </button>
      </header>

      <label className="dm-inbox-search">
        <span aria-hidden="true">⌕</span>
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
        />
      </label>

      <div className="dm-inbox-section">
        <h3>{labels.friends}</h3>
        {visibleFriends.length === 0 && <p className="dm-inbox-empty">{labels.noFriends}</p>}
        {visibleFriends.map((friend) => {
          const count = unread[friend.id] || 0;
          return (
            <button
              className="dm-inbox-row"
              type="button"
              key={friend.id}
              onClick={() => onOpenDm(friend)}
            >
              <span className="avatar">
                {friend.avatarData ? (
                  <img src={friend.avatarData} alt="" />
                ) : (
                  displayInitials(friend.username)
                )}
              </span>
              <span className="dm-inbox-row-copy">
                <b>{friend.username}</b>
                <small>{friend.status === "online" ? "●" : "○"}</small>
              </span>
              {count > 0 && <span className="dm-inbox-unread">{count > 99 ? "99+" : count}</span>}
            </button>
          );
        })}
      </div>

      <div className="dm-inbox-section">
        <h3>{labels.groups}</h3>
        {visibleConversations.length === 0 && (
          <p className="dm-inbox-empty">{labels.noConversations}</p>
        )}
        {visibleConversations.map((conversation) => {
          const count = unread[conversation.id] || 0;
          return (
            <button
              className="dm-inbox-row"
              type="button"
              key={conversation.id}
              onClick={() => onOpenConversation(conversation)}
            >
              <span className="avatar dm-group-avatar">◎</span>
              <span className="dm-inbox-row-copy">
                <b>{conversationTitle(conversation, currentAccountId) || labels.groups}</b>
                <small>{labels.memberCount(conversation.members.length)}</small>
              </span>
              {count > 0 && <span className="dm-inbox-unread">{count > 99 ? "99+" : count}</span>}
            </button>
          );
        })}
      </div>

      <button className="dm-inbox-requests" type="button" onClick={onOpenFriends}>
        <span>✉</span>
        <span>{labels.messageRequests}</span>
      </button>
      {mentionCount > 0 && (
        <div className="dm-inbox-mentions" role="status">
          <span>＠</span>
          <span>{labels.mentions}</span>
          <b>{mentionCount > 99 ? "99+" : mentionCount}</b>
        </div>
      )}
    </section>
  );
}
