/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { ChatMessage } from "@echoverse/contracts";
import type { RefObject } from "react";
import { ChannelMessageList, ChatComposer } from "./chat.js";
import { ServerTopbar, type PresenceStatus, type ServerTopbarLabels } from "./topbar.js";
import {
  VideoStage,
  VoiceControls,
  type VideoStageLabels,
  type VoiceControlsLabels
} from "./video.js";

export type ServerViewLabels = {
  topbar: ServerTopbarLabels;
  video: VideoStageLabels;
  channel: {
    welcomeTitle: string;
    channelBeginning: string;
  };
  composer: {
    inputLabel: string;
    placeholder: string;
    emojiLabel: string;
    sendLabel: string;
  };
  voice: VoiceControlsLabels;
};

/** Shared server channel composition; renderers retain state, transport, and media effects. */
export function ServerView({
  guildName,
  incomingRequestCount,
  status,
  videoLayout,
  videoStatus,
  localVideoRef,
  remoteVideoHostRef,
  localVideoActive,
  localSpeaking,
  muted,
  cameraOn,
  screenOn,
  connected,
  messages,
  text,
  error,
  labels,
  formatDate,
  onOpenMediaSettings,
  onOpenFriends,
  onStatusChange,
  onVideoLayoutChange,
  onTextChange,
  onAddEmoji,
  onSendMessage,
  onToggleMute,
  onToggleCamera,
  onToggleScreen,
  onEndCall,
  onDismissError
}: {
  guildName?: string;
  incomingRequestCount: number;
  status: PresenceStatus;
  videoLayout: "grid" | "focus";
  videoStatus: string;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoHostRef: RefObject<HTMLDivElement>;
  localVideoActive: boolean;
  localSpeaking: boolean;
  muted: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  connected: boolean;
  messages: ChatMessage[];
  text: string;
  error?: string;
  labels: ServerViewLabels;
  formatDate: (value: string) => string;
  onOpenMediaSettings: () => void;
  onOpenFriends: () => void;
  onStatusChange: (status: PresenceStatus) => void;
  onVideoLayoutChange: (layout: "grid" | "focus") => void;
  onTextChange: (value: string) => void;
  onAddEmoji: () => void;
  onSendMessage: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void | Promise<void>;
  onToggleScreen: () => void | Promise<void>;
  onEndCall: () => void | Promise<void>;
  onDismissError: () => void;
}) {
  return (
    <>
      <ServerTopbar
        guildName={guildName}
        incomingRequestCount={incomingRequestCount}
        status={status}
        labels={labels.topbar}
        onOpenMediaSettings={onOpenMediaSettings}
        onOpenFriends={onOpenFriends}
        onStatusChange={onStatusChange}
      />

      <VideoStage
        layout={videoLayout}
        status={videoStatus}
        localVideoRef={localVideoRef}
        remoteVideoHostRef={remoteVideoHostRef}
        localVideoActive={localVideoActive}
        localSpeaking={localSpeaking}
        muted={muted}
        labels={labels.video}
        onLayoutChange={onVideoLayoutChange}
      />

      <ChannelMessageList
        messages={messages}
        welcomeTitle={labels.channel.welcomeTitle}
        channelBeginning={labels.channel.channelBeginning}
        formatDate={formatDate}
      />

      <ChatComposer
        text={text}
        inputLabel={labels.composer.inputLabel}
        placeholder={labels.composer.placeholder}
        emojiLabel={labels.composer.emojiLabel}
        sendLabel={labels.composer.sendLabel}
        onTextChange={onTextChange}
        onAddEmoji={onAddEmoji}
        onSend={onSendMessage}
      />

      <VoiceControls
        muted={muted}
        cameraOn={cameraOn}
        screenOn={screenOn}
        connected={connected}
        labels={labels.voice}
        onToggleMute={onToggleMute}
        onToggleCamera={onToggleCamera}
        onToggleScreen={onToggleScreen}
        onEndCall={onEndCall}
      />

      {error && (
        <div className="floating-error" onClick={onDismissError}>
          {error}
        </div>
      )}
    </>
  );
}
