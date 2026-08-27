/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { FriendUser, IncomingCall } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type CallAlertLabels = {
  incomingPrivateCall: string;
  answer: string;
  reject: string;
  endCall: string;
  ringing: string;
  privateConversation: (time: string) => string;
};

/** Shared incoming-call prompt and active private-call status bar. */
export function CallAlerts({
  incomingCall,
  privateCallPeer,
  ringing,
  callTime,
  labels,
  onAnswer,
  onEndCall
}: {
  incomingCall: IncomingCall | null;
  privateCallPeer: FriendUser | null;
  ringing: boolean;
  callTime: string;
  labels: CallAlertLabels;
  onAnswer: (accepted: boolean) => void;
  onEndCall: () => void;
}) {
  return (
    <>
      {incomingCall && (
        <div className="incoming-call">
          <div className="call-avatar">
            {incomingCall.fromAvatarData ? (
              <img src={incomingCall.fromAvatarData} alt="" />
            ) : (
              displayInitials(incomingCall.fromUsername)
            )}
          </div>
          <div className="call-info">
            <b>{incomingCall.fromUsername}</b>
            <span>{labels.incomingPrivateCall}</span>
          </div>
          <button aria-label={labels.answer} className="answer-call" onClick={() => onAnswer(true)}>
            📞
          </button>
          <button
            aria-label={labels.reject}
            className="reject-call"
            onClick={() => onAnswer(false)}
          >
            ✕
          </button>
        </div>
      )}

      {privateCallPeer && (
        <div className="private-call-bar">
          <span>
            📞 {privateCallPeer.username}
            {ringing ? ` ${labels.ringing}` : ` ${labels.privateConversation(callTime)}`}
          </span>
          <button onClick={onEndCall}>{labels.endCall}</button>
        </div>
      )}
    </>
  );
}
