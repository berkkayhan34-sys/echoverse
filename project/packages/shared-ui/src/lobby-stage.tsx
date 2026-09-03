/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { PeerInfo } from "@echoverse/contracts";
import type { ReactNode } from "react";
import { displayInitials } from "./text.js";

export type LobbyStageLabels = {
  subtitle: string;
  participants: (count: number) => string;
  emptyTitle: string;
  emptyDescription: string;
  speaking: string;
  muted: string;
  activityJoined?: (username: string) => string;
  controls?: {
    microphone: string;
    mute: string;
    camera: string;
    cameraOff: string;
    screenShare: string;
    stopScreenShare: string;
    endCall: string;
    addParticipant: string;
    mediaSettings: string;
  };
};

type LobbyControlIconName =
  "camera" | "screen" | "microphone" | "hangup" | "participants" | "settings";

function LobbyControlIcon({ name }: { name: LobbyControlIconName }) {
  const paths: Record<LobbyControlIconName, ReactNode> = {
    camera: (
      <>
        <rect x="3" y="6" width="11" height="10" rx="2" />
        <path d="m14 9 6-3v12l-6-3" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    microphone: (
      <>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    hangup: (
      <>
        <path d="M4 15.5a14 14 0 0 1 16 0" />
        <path d="m8 14 1 4M16 14l-1 4" />
      </>
    ),
    participants: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 16a4.5 4.5 0 0 1 5.5 3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19 12 2-1-2-3-2 1a7 7 0 0 0-2-1l-.3-2h-3.4L11 8a7 7 0 0 0-2 1L7 8l-2 3 2 1a7 7 0 0 0 0 2l-2 1 2 3 2-1a7 7 0 0 0 2 1l.3 2h3.4l.3-2a7 7 0 0 0 2-1l2 1 2-3-2-1a7 7 0 0 0 0-2Z" />
      </>
    )
  };

  return (
    <svg
      aria-hidden="true"
      className="lobby-control-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/** Shared live voice-room stage; media tracks remain renderer-owned. */
export function LobbyStage({
  channelName,
  presence,
  socketId,
  localSpeaking,
  muted,
  speakingPeers,
  labels,
  cameraOn = false,
  screenOn = false,
  connected = false,
  controlsVisible = false,
  onToggleMute,
  onToggleCamera,
  onToggleScreen,
  onEndCall,
  onOpenFriends,
  onOpenMediaSettings
}: {
  channelName: string;
  presence: PeerInfo[];
  socketId?: string;
  localSpeaking: boolean;
  muted: boolean;
  speakingPeers: Record<string, boolean>;
  labels: LobbyStageLabels;
  cameraOn?: boolean;
  screenOn?: boolean;
  connected?: boolean;
  controlsVisible?: boolean;
  onToggleMute?: () => void;
  onToggleCamera?: () => void | Promise<void>;
  onToggleScreen?: () => void | Promise<void>;
  onEndCall?: () => void | Promise<void>;
  onOpenFriends?: () => void;
  onOpenMediaSettings?: () => void;
}) {
  return (
    <section className={`lobby-stage ${presence.length > 0 ? "has-participants" : "empty"}`}>
      <header className="lobby-stage-header">
        <div>
          <b>{channelName}</b>
          <span>{labels.subtitle}</span>
        </div>
        <span className="lobby-stage-count">{labels.participants(presence.length)}</span>
      </header>

      {presence.length > 0 ? (
        <div className="lobby-participant-grid" aria-live="polite">
          {presence.map((peer) => {
            const isSelf = peer.socketId === socketId;
            const speaking = isSelf ? localSpeaking && !muted : !!speakingPeers[peer.socketId];

            return (
              <article
                className={`lobby-participant ${speaking ? "speaking" : ""}`}
                key={peer.socketId}
              >
                <div className="lobby-participant-avatar">
                  {peer.avatarData ? (
                    <img src={peer.avatarData} alt="" />
                  ) : (
                    displayInitials(peer.username)
                  )}
                </div>
                <strong>{peer.username}</strong>
                <span className="lobby-participant-state">
                  {speaking ? labels.speaking : isSelf && muted ? labels.muted : ""}
                </span>
                <div className="lobby-wave" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((bar) => (
                    <i key={bar} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="lobby-empty-state">
          <div className="lobby-empty-icon" aria-hidden="true">
            ◉
          </div>
          <h2>{labels.emptyTitle}</h2>
          <p>{labels.emptyDescription}</p>
        </div>
      )}

      {controlsVisible &&
        labels.controls &&
        onToggleMute &&
        onToggleCamera &&
        onToggleScreen &&
        onEndCall && (
          <div className="lobby-controls" aria-label={channelName}>
            <button
              type="button"
              className={cameraOn ? "active-control" : ""}
              onClick={onToggleCamera}
            >
              <LobbyControlIcon name="camera" />
              <span>{cameraOn ? labels.controls.cameraOff : labels.controls.camera}</span>
            </button>
            <button
              type="button"
              className={screenOn ? "active-control" : ""}
              onClick={onToggleScreen}
            >
              <LobbyControlIcon name="screen" />
              <span>
                {screenOn ? labels.controls.stopScreenShare : labels.controls.screenShare}
              </span>
            </button>
            <button
              type="button"
              className={!muted ? "active-control" : "danger"}
              onClick={onToggleMute}
            >
              <LobbyControlIcon name="microphone" />
              <span>{muted ? labels.controls.mute : labels.controls.microphone}</span>
            </button>
            <button
              type="button"
              className="disconnect-btn"
              onClick={onEndCall}
              disabled={!connected}
            >
              <LobbyControlIcon name="hangup" />
              <span>{labels.controls.endCall}</span>
            </button>
            {onOpenFriends && (
              <button type="button" onClick={onOpenFriends}>
                <LobbyControlIcon name="participants" />
                <span>{labels.controls.addParticipant}</span>
              </button>
            )}
            {onOpenMediaSettings && (
              <button type="button" onClick={onOpenMediaSettings}>
                <LobbyControlIcon name="settings" />
                <span>{labels.controls.mediaSettings}</span>
              </button>
            )}
          </div>
        )}

      {presence.length > 0 && labels.activityJoined && (
        <div className="lobby-activity" aria-live="polite">
          {presence.slice(0, 4).map((peer) => (
            <div className="lobby-activity-row" key={`activity:${peer.socketId}`}>
              <span className="lobby-activity-icon" aria-hidden="true">
                ◉
              </span>
              <span>{labels.activityJoined?.(peer.username)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
