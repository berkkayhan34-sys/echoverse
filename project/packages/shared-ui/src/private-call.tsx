/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { displayInitials } from "./text.js";

export type PrivateCallStageLabels = {
  incoming: string;
  ringing: string;
  privateConversation: (time: string) => string;
  microphone: string;
  mute: string;
  unmute: string;
  deafen: string;
  undeafen: string;
  pushToTalkTitle: string;
  speaking: string;
  pressToTalk: string;
  voiceActivity: string;
  close: string;
};

/** Shared private-call presentation; signaling and media state stay in the renderer. */
export function PrivateCallStage({
  peer,
  callState,
  callTime,
  muted,
  deafened,
  pushToTalk,
  pttPressed,
  labels,
  onToggleMute,
  onToggleDeafen,
  onTogglePushToTalk,
  onEndCall
}: {
  peer: { username: string; avatarData?: string | null };
  callState: "calling" | "ringing" | "connected";
  callTime: string;
  muted: boolean;
  deafened: boolean;
  pushToTalk: boolean;
  pttPressed: boolean;
  labels: PrivateCallStageLabels;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onTogglePushToTalk: () => void;
  onEndCall: () => void | Promise<void>;
}) {
  return (
    <div className={`private-call-stage ${callState}`}>
      <div className="call-stage-avatar">
        {peer.avatarData ? <img src={peer.avatarData} alt="" /> : displayInitials(peer.username)}
      </div>

      <h2>{peer.username}</h2>
      <p>
        {callState === "calling"
          ? labels.ringing
          : callState === "connected"
            ? labels.privateConversation(callTime)
            : labels.incoming}
      </p>

      {callState === "connected" && (
        <div className="private-call-controls">
          <button onClick={onToggleMute}>
            {muted ? `🔇 ${labels.unmute}` : `🎙️ ${labels.microphone}`}
          </button>
          <button onClick={onToggleDeafen}>
            {deafened ? `🔊 ${labels.undeafen}` : `🎧 ${labels.deafen}`}
          </button>
          <button
            className={pushToTalk ? "active" : ""}
            onClick={onTogglePushToTalk}
            title={labels.pushToTalkTitle}
          >
            {pushToTalk
              ? pttPressed
                ? `🟢 ${labels.speaking}`
                : `⌨ ${labels.pressToTalk}`
              : `🎙 ${labels.voiceActivity}`}
          </button>
          <button className="hangup" onClick={onEndCall}>
            ☎ {labels.close}
          </button>
        </div>
      )}
    </div>
  );
}
