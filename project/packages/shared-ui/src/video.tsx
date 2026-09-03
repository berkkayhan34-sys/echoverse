/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { RefObject } from "react";

type VideoControlIconName = "grid" | "focus" | "microphone" | "camera" | "screen" | "hangup";

function VideoControlIcon({ name }: { name: VideoControlIconName }) {
  const shapes = {
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    focus: <path d="M5 5h5M5 5v5M19 5h-5M19 5v5M5 19h5M5 19v-5M19 19h-5M19 19v-5" />,
    microphone: (
      <>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    camera: (
      <>
        <rect x="3" y="6" width="12" height="12" rx="2" />
        <path d="m15 10 6-3v10l-6-3" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    hangup: (
      <>
        <path d="M4 15.5a14 14 0 0 1 16 0" />
        <path d="m8 14 1 4M16 14l-1 4" />
      </>
    )
  }[name];

  return (
    <svg className="video-control-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {shapes}
    </svg>
  );
}

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
            <VideoControlIcon name="grid" /> <span>{labels.grid}</span>
          </button>
          <button
            className={layout === "focus" ? "active" : ""}
            onClick={() => onLayoutChange("focus")}
          >
            <VideoControlIcon name="focus" /> <span>{labels.focus}</span>
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
        <VideoControlIcon name="microphone" />
        <span>{muted ? labels.mute : labels.microphone}</span>
      </button>

      <button className={cameraOn ? "active-control" : ""} onClick={onToggleCamera}>
        <VideoControlIcon name="camera" />
        <span>{cameraOn ? labels.cameraOff : labels.camera}</span>
      </button>

      <button className={screenOn ? "active-control" : ""} onClick={onToggleScreen}>
        <VideoControlIcon name="screen" />
        <span>{screenOn ? labels.stopScreenShare : labels.screenShare}</span>
      </button>

      <button className="disconnect-btn" onClick={onEndCall}>
        <VideoControlIcon name="hangup" />
        <span>{labels.endCall}</span>
      </button>

      <span className={`connection ${connected ? "connected" : "offline"}`}>
        <i aria-hidden="true" />
        {connected ? labels.online : labels.offline}
      </span>
    </div>
  );
}
