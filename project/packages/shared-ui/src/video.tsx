/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { RefObject } from "react";

export type VideoStageLabels = {
  videoShare: string;
  grid: string;
  focus: string;
};

/** Shared video layout and media-host markup; the renderer owns the tracks and refs. */
export function VideoStage({
  layout,
  status,
  localVideoRef,
  remoteVideoHostRef,
  localVideoActive,
  localSpeaking,
  muted,
  labels,
  onLayoutChange
}: {
  layout: "grid" | "focus";
  status: string;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoHostRef: RefObject<HTMLDivElement>;
  localVideoActive: boolean;
  localSpeaking: boolean;
  muted: boolean;
  labels: VideoStageLabels;
  onLayoutChange: (layout: "grid" | "focus") => void;
}) {
  return (
    <>
      <div className="video-toolbar">
        <div>
          <b>{labels.videoShare}</b>
          <span>{status}</span>
        </div>
        <div className="video-layout-actions">
          <button
            className={layout === "grid" ? "active" : ""}
            onClick={() => onLayoutChange("grid")}
          >
            ▦ {labels.grid}
          </button>
          <button
            className={layout === "focus" ? "active" : ""}
            onClick={() => onLayoutChange("focus")}
          >
            ▣ {labels.focus}
          </button>
        </div>
      </div>

      <div className={`video-zone ${layout === "focus" ? "focus-layout" : "grid-layout"}`}>
        <video
          ref={localVideoRef}
          muted
          autoPlay
          playsInline
          className={
            localVideoActive
              ? `local-video ${localSpeaking && !muted ? "speaking-video" : ""}`
              : "hidden"
          }
        />

        <div ref={remoteVideoHostRef} className="remote-video-host" />
      </div>
    </>
  );
}

export type VoiceControlsLabels = {
  mute: string;
  microphone: string;
  camera: string;
  cameraOff: string;
  screenShare: string;
  stopScreenShare: string;
  endCall: string;
  online: string;
  offline: string;
};

/** Shared voice/video action bar; media commands remain renderer-owned callbacks. */
export function VoiceControls({
  muted,
  cameraOn,
  screenOn,
  connected,
  labels,
  onToggleMute,
  onToggleCamera,
  onToggleScreen,
  onEndCall
}: {
  muted: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  connected: boolean;
  labels: VoiceControlsLabels;
  onToggleMute: () => void;
  onToggleCamera: () => void | Promise<void>;
  onToggleScreen: () => void | Promise<void>;
  onEndCall: () => void | Promise<void>;
}) {
  return (
    <div className="call-controls">
      <button className={muted ? "danger" : ""} onClick={onToggleMute}>
        {muted ? `🔇 ${labels.mute}` : `🎙️ ${labels.microphone}`}
      </button>

      <button className={cameraOn ? "active-control" : ""} onClick={onToggleCamera}>
        📹 {cameraOn ? labels.cameraOff : labels.camera}
      </button>

      <button className={screenOn ? "active-control" : ""} onClick={onToggleScreen}>
        🖥️ {screenOn ? labels.stopScreenShare : labels.screenShare}
      </button>

      <button className="disconnect-btn" onClick={onEndCall}>
        ☎ {labels.endCall}
      </button>

      <span className="connection">● {connected ? labels.online : labels.offline}</span>
    </div>
  );
}
