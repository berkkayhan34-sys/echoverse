/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { FriendUser } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type DirectMessageHeaderLabels = {
  back: string;
  block: string;
  searchPlaceholder: string;
  calling: string;
  call: string;
  endCall: string;
  search?: string;
  addParticipant?: string;
};

/** Shared direct-message header; confirmation and transport commands stay in the renderer. */
export function DirectMessageHeader({
  peer,
  statusLabel,
  searchQuery,
  callState,
  labels,
  onBack,
  onSearchQueryChange,
  onSearch,
  onBlock,
  onCall,
  onAddParticipant
}: {
  peer: FriendUser;
  statusLabel: string;
  searchQuery: string;
  callState: "idle" | "calling" | "ringing" | "connected";
  labels: DirectMessageHeaderLabels;
  onBack: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearch?: () => void;
  onBlock: () => void;
  onCall: () => void;
  onAddParticipant?: () => void;
}) {
  return (
    <header className="dm-page-header">
      <div className="dm-page-user">
        <button className="dm-back" aria-label={labels.back} onClick={onBack}>
          ←
        </button>

        <div className="avatar">
          {peer.avatarData ? <img src={peer.avatarData} alt="" /> : displayInitials(peer.username)}
        </div>

        <div>
          <b>{peer.username}</b>
          <small>{statusLabel}</small>
        </div>
      </div>

      <div className="dm-page-actions">
        <input
          className="dm-header-search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch?.();
          }}
        />
        {onSearch && labels.search && (
          <button className="dm-search-button" onClick={onSearch} aria-label={labels.search}>
            🔎
          </button>
        )}
        <button
          className="dm-block-button"
          aria-label={labels.block}
          title={labels.block}
          onClick={onBlock}
        >
          🚫
        </button>
        <button
          className={`dm-call-button ${callState === "connected" ? "call-connected" : ""}`}
          onClick={onCall}
        >
          {callState === "calling"
            ? `📞 ${labels.calling}`
            : callState === "connected"
              ? `☎ ${labels.endCall}`
              : `📞 ${labels.call}`}
        </button>
        {callState !== "idle" && onAddParticipant && labels.addParticipant && (
          <button className="dm-add-participant-button" onClick={onAddParticipant}>
            ♙ {labels.addParticipant}
          </button>
        )}
      </div>
    </header>
  );
}
