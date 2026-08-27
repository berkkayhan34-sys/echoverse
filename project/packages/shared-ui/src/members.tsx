/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { PeerInfo } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type MembersPanelLabels = {
  onlineCount: (count: number) => string;
  botsCount: string;
  self: string;
  muteOnlyYou: string;
  muted: string;
  volumeFor: (username: string) => string;
  botName: string;
  botHelp: string;
};

/** Shared presence/member panel; audio state and controls remain renderer-owned. */
export function MembersPanel({
  presence,
  socketId,
  localSpeaking,
  muted,
  speakingPeers,
  peerMuted,
  peerVolumes,
  labels,
  onTogglePeerMute,
  onPeerVolumeChange
}: {
  presence: PeerInfo[];
  socketId?: string;
  localSpeaking: boolean;
  muted: boolean;
  speakingPeers: Record<string, boolean>;
  peerMuted: Record<string, boolean>;
  peerVolumes: Record<string, number>;
  labels: MembersPanelLabels;
  onTogglePeerMute: (socketId: string) => void;
  onPeerVolumeChange: (socketId: string, volume: number) => void;
}) {
  return (
    <aside className="members">
      <div className="members-title">{labels.onlineCount(presence.length)}</div>

      {presence.map((peer) => {
        const isSelf = peer.socketId === socketId;
        const speaking = isSelf
          ? localSpeaking && !muted
          : !!speakingPeers[peer.socketId] && !peerMuted[peer.socketId];

        return (
          <div className={`member-card ${speaking ? "speaking" : ""}`} key={peer.socketId}>
            <div className="member">
              <div className="avatar">
                {peer.avatarData ? (
                  <img src={peer.avatarData} alt="" />
                ) : (
                  displayInitials(peer.username)
                )}
              </div>

              <span>
                {peer.username}
                {isSelf ? labels.self : ""}
              </span>
            </div>

            {!isSelf && (
              <div className="peer-audio-controls">
                <button
                  className={peerMuted[peer.socketId] ? "peer-muted" : ""}
                  aria-label={labels.muteOnlyYou}
                  onClick={() => onTogglePeerMute(peer.socketId)}
                  title={labels.muteOnlyYou}
                >
                  {peerMuted[peer.socketId] ? "🔇" : "🔊"}
                </button>

                <input
                  type="range"
                  min="0"
                  max="200"
                  value={peerVolumes[peer.socketId] ?? 100}
                  aria-label={labels.volumeFor(peer.username)}
                  onChange={(event) =>
                    onPeerVolumeChange(peer.socketId, Number(event.target.value))
                  }
                />

                <span>
                  {peerMuted[peer.socketId]
                    ? labels.muted
                    : `${peerVolumes[peer.socketId] ?? 100}%`}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div className="members-title bots">{labels.botsCount}</div>

      <div className="member">
        <div className="avatar bot">{displayInitials(labels.botName)}</div>

        <div>
          <span>{labels.botName}</span>
          <small className="bot-help">{labels.botHelp}</small>
        </div>
      </div>
    </aside>
  );
}
