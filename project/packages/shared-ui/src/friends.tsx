/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { FriendUser } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type FriendsModalLabels = {
  title: string;
  close: string;
  searchPlaceholder: string;
  search: string;
  searchResults: string;
  incomingRequests: string;
  outgoingRequests: string;
  myFriends: string;
  noFriends: string;
  add: string;
  accept: string;
  decline: string;
  openDirectMessage: string;
  call: string;
  remove: string;
};

/** Shared friends, request, and direct-message entrypoint modal. */
export function FriendsModal({
  friends,
  incomingRequests,
  outgoingRequests,
  friendSearchResults,
  unreadDm,
  searchQuery,
  labels,
  onClose,
  onSearchQueryChange,
  onSearch,
  onSendFriendRequest,
  onRespondFriendRequest,
  onOpenDm,
  onCallFriend,
  onRemoveFriend
}: {
  friends: FriendUser[];
  incomingRequests: FriendUser[];
  outgoingRequests: FriendUser[];
  friendSearchResults: FriendUser[];
  unreadDm: Record<string, number>;
  searchQuery: string;
  labels: FriendsModalLabels;
  onClose: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onSendFriendRequest: (accountId: string) => void;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => void;
  onOpenDm: (friend: FriendUser) => void;
  onCallFriend: (friend: FriendUser) => void;
  onRemoveFriend: (accountId: string) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal friends-modal">
        <div className="friends-header">
          <h2>{labels.title}</h2>
          <button aria-label={labels.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="friend-search-row">
          <input
            aria-label={labels.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder={labels.searchPlaceholder}
          />
          <button onClick={onSearch}>{labels.search}</button>
        </div>

        {friendSearchResults.length > 0 && (
          <div className="friend-section">
            <h3>{labels.searchResults}</h3>
            {friendSearchResults.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                <button onClick={() => onSendFriendRequest(friend.id)}>＋ {labels.add}</button>
              </div>
            ))}
          </div>
        )}

        {incomingRequests.length > 0 && (
          <div className="friend-section">
            <h3>{labels.incomingRequests}</h3>
            {incomingRequests.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                <div className="friend-actions">
                  <button
                    aria-label={labels.accept}
                    disabled={!friend.friendshipId}
                    onClick={() => {
                      if (friend.friendshipId) onRespondFriendRequest(friend.friendshipId, true);
                    }}
                  >
                    ✓
                  </button>
                  <button
                    aria-label={labels.decline}
                    disabled={!friend.friendshipId}
                    onClick={() => {
                      if (friend.friendshipId) onRespondFriendRequest(friend.friendshipId, false);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {outgoingRequests.length > 0 && (
          <div className="friend-section">
            <h3>{labels.outgoingRequests}</h3>
            {outgoingRequests.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                <small className="friend-pending">{labels.outgoingRequests}</small>
              </div>
            ))}
          </div>
        )}

        <div className="friend-section">
          <h3>{labels.myFriends}</h3>
          {friends.length === 0 && <small>{labels.noFriends}</small>}

          {friends.map((friend) => (
            <div className="friend-row" key={friend.id}>
              <div className="friend-user">
                <div className="avatar">
                  {friend.avatarData ? (
                    <img src={friend.avatarData} alt="" />
                  ) : (
                    displayInitials(friend.username)
                  )}
                </div>
                <b>{friend.username}</b>
              </div>

              <div className="friend-actions">
                <button
                  className="dm-open-button"
                  aria-label={labels.openDirectMessage}
                  onClick={() => onOpenDm(friend)}
                >
                  💬
                  {(unreadDm[friend.id] || 0) > 0 && (
                    <span className="dm-unread-badge">{Math.min(unreadDm[friend.id], 99)}</span>
                  )}
                </button>
                <button aria-label={labels.call} onClick={() => onCallFriend(friend)}>
                  📞
                </button>
                <button aria-label={labels.remove} onClick={() => onRemoveFriend(friend.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
