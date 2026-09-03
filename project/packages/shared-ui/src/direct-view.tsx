/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DmMessage, FriendUser } from "@echoverse/contracts";
import { DirectMessageHeader } from "./direct-header.js";
import { DirectMessageComposer, DirectMessageThread } from "./direct.js";
import { PrivateCallStage } from "./private-call.js";

export type DirectMessageViewLabels = {
  header: {
    back: string;
    block: string;
    searchPlaceholder: string;
    calling: string;
    call: string;
    endCall: string;
    search?: string;
    addParticipant?: string;
  };
  call: {
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
  thread: {
    today: string;
    emptyConversation: string;
    deletedReply: string;
    deletedMessage: string;
    message: string;
    edited: string;
    download: string;
    reply: string;
    edit: string;
    delete: string;
  };
  composer: {
    inputLabel: string;
    messagePlaceholder: string;
    editPlaceholder: string;
    fileLabel: string;
    clearLabel: string;
    dragHint: string;
    sendLabel: string;
    saveLabel: string;
  };
};

/**
 * Shared direct-message screen composition. Renderers provide localized text,
 * state, and commands; transport, confirmation, media, and file effects stay
 * at the renderer boundary.
 */
export function DirectMessageView({
  peer,
  statusLabel,
  searchQuery,
  callState,
  callTime,
  muted,
  deafened,
  pushToTalk,
  pttPressed,
  messages,
  currentAccountId,
  currentUsername,
  currentAvatarData,
  text,
  editingLabel,
  replyingLabel,
  attachmentReadyLabel,
  dragActive,
  threadRef,
  fileInputRef,
  labels,
  formatDate,
  formatTime,
  onBack,
  onSearchQueryChange,
  onSearch,
  onBlock,
  onCall,
  onAddParticipant,
  onToggleMute,
  onToggleDeafen,
  onTogglePushToTalk,
  onEndCall,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onDownloadAttachment,
  onOpenAttachment,
  onFileSelected,
  onDropFile,
  onDragActiveChange,
  onTextChange,
  onTypingChange,
  onSend,
  onClearContext
}: {
  peer: FriendUser;
  statusLabel: string;
  searchQuery: string;
  callState: "idle" | "calling" | "ringing" | "connected";
  callTime: string;
  muted: boolean;
  deafened: boolean;
  pushToTalk: boolean;
  pttPressed: boolean;
  messages: DmMessage[];
  currentAccountId: string;
  currentUsername: string;
  currentAvatarData?: string | null;
  text: string;
  editingLabel?: string;
  replyingLabel?: string;
  attachmentReadyLabel?: string;
  dragActive: boolean;
  threadRef?: { current: HTMLDivElement | null };
  fileInputRef?: { current: HTMLInputElement | null };
  labels: DirectMessageViewLabels;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  onBack: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearch?: () => void;
  onBlock: () => void;
  onCall: () => void;
  onAddParticipant?: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onTogglePushToTalk: () => void;
  onEndCall: () => void;
  onReply: (message: DmMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (message: DmMessage) => void;
  onDelete: (message: DmMessage) => void;
  onDownloadAttachment: (message: DmMessage) => void;
  onOpenAttachment: (data: string) => void;
  onFileSelected: (file: File | null) => void;
  onDropFile: (file: File | null) => void;
  onDragActiveChange: (active: boolean) => void;
  onTextChange: (value: string) => void;
  onTypingChange: (typing: boolean) => void;
  onSend: () => void;
  onClearContext: () => void;
}) {
  return (
    <div className="dm-fullpage">
      <DirectMessageHeader
        peer={peer}
        statusLabel={statusLabel}
        searchQuery={searchQuery}
        callState={callState}
        labels={labels.header}
        onBack={onBack}
        onSearchQueryChange={onSearchQueryChange}
        onSearch={onSearch}
        onBlock={onBlock}
        onCall={onCall}
        onAddParticipant={onAddParticipant}
      />

      {callState !== "idle" && (
        <PrivateCallStage
          peer={peer}
          callState={callState}
          callTime={callTime}
          muted={muted}
          deafened={deafened}
          pushToTalk={pushToTalk}
          pttPressed={pttPressed}
          labels={labels.call}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
          onTogglePushToTalk={onTogglePushToTalk}
          onEndCall={onEndCall}
        />
      )}

      <DirectMessageThread
        messages={messages}
        query={searchQuery}
        currentAccountId={currentAccountId}
        currentUsername={currentUsername}
        currentAvatarData={currentAvatarData}
        peer={peer}
        threadRef={threadRef}
        labels={labels.thread}
        formatDate={formatDate}
        formatTime={formatTime}
        onReply={onReply}
        onReact={onReact}
        onEdit={onEdit}
        onDelete={onDelete}
        onDownloadAttachment={onDownloadAttachment}
        onOpenAttachment={onOpenAttachment}
      />

      <DirectMessageComposer
        text={text}
        inputLabel={labels.composer.inputLabel}
        placeholder={
          editingLabel ? labels.composer.editPlaceholder : labels.composer.messagePlaceholder
        }
        fileLabel={labels.composer.fileLabel}
        clearLabel={labels.composer.clearLabel}
        dragHint={labels.composer.dragHint}
        sendLabel={editingLabel ? labels.composer.saveLabel : labels.composer.sendLabel}
        editingLabel={editingLabel}
        replyingLabel={replyingLabel}
        attachmentReadyLabel={attachmentReadyLabel}
        dragActive={dragActive}
        fileInputRef={fileInputRef}
        onFileSelected={onFileSelected}
        onDropFile={onDropFile}
        onDragActiveChange={onDragActiveChange}
        onTextChange={onTextChange}
        onTypingChange={onTypingChange}
        onSend={onSend}
        onClearContext={onClearContext}
      />
    </div>
  );
}
