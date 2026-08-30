/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  DmConversation,
  FriendUser,
  IncomingCall,
  PeerInfo,
  ScreenSource
} from "@echoverse/contracts";
import { CallAlerts, type CallAlertLabels } from "./calls.js";
import {
  CreateGuildDialog,
  JoinGuildDialog,
  type CreateGuildDialogLabels,
  type JoinGuildDialogLabels
} from "./guild-dialog.js";
import { FriendsModal, type FriendsModalLabels } from "./friends.js";
import { MediaSettingsModal, type MediaSettingsLabels } from "./media-settings.js";
import { MembersPanel, type MembersPanelLabels } from "./members.js";
import { ScreenPicker, type ScreenPickerLabels } from "./screen.js";
import { InviteDialog, type InviteDialogLabels } from "./invite-dialog.js";

export type WorkspaceOverlayLabels = {
  members: MembersPanelLabels;
  media: MediaSettingsLabels;
  friends: FriendsModalLabels;
  calls: CallAlertLabels;
  screen: ScreenPickerLabels;
  guild: CreateGuildDialogLabels;
  joinGuild: JoinGuildDialogLabels;
  invite: InviteDialogLabels;
};

/** Shared workspace overlays; renderers retain state, persistence, and platform effects. */
export function WorkspaceOverlays({
  presence,
  socketId,
  localSpeaking,
  muted,
  speakingPeers,
  peerMuted,
  peerVolumes,
  showAudioSettings,
  audioInputs,
  audioOutputs,
  videoInputs,
  selectedInput,
  selectedOutput,
  selectedCamera,
  screenQuality,
  screenFps,
  lobbySoundsEnabled,
  effectVolume,
  showFriends,
  friends,
  incomingRequests,
  outgoingRequests,
  friendSearchResults,
  conversations,
  unreadDm,
  friendSearch,
  incomingCall,
  privateCallPeer,
  ringing,
  callTime,
  showScreenPicker,
  screenSources,
  screenPermission,
  showCreate,
  showJoin,
  newGuildName,
  joinCode,
  inviteGuildName,
  inviteToken,
  inviteCopied,
  labels,
  onTogglePeerMute,
  onPeerVolumeChange,
  onInputChange,
  onOutputChange,
  onCameraChange,
  onScreenQualityChange,
  onScreenFpsChange,
  onLobbySoundsChange,
  onEffectVolumeChange,
  onCloseAudioSettings,
  onCloseFriends,
  onFriendSearchChange,
  onSearchFriends,
  onSendFriendRequest,
  onRespondFriendRequest,
  onCancelFriendRequest,
  onOpenDm,
  onCallFriend,
  onRemoveFriend,
  onOpenConversation,
  onCreateGroup,
  currentAccountId,
  onGroupPromote,
  onGroupRemove,
  onGroupLeave,
  onAnswerCall,
  onEndCall,
  onCloseScreenPicker,
  onOpenSystemSettings,
  onSelectScreenSource,
  onGuildNameChange,
  onCancelCreate,
  onCreateGuild,
  onJoinCodeChange,
  onCancelJoin,
  onJoinGuild,
  onCopyInvite,
  onCloseInvite
}: {
  presence: PeerInfo[];
  socketId?: string;
  localSpeaking: boolean;
  muted: boolean;
  speakingPeers: Record<string, boolean>;
  peerMuted: Record<string, boolean>;
  peerVolumes: Record<string, number>;
  showAudioSettings: boolean;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedInput: string;
  selectedOutput: string;
  selectedCamera: string;
  screenQuality: "720" | "1080";
  screenFps: 30 | 60;
  lobbySoundsEnabled: boolean;
  effectVolume: number;
  showFriends: boolean;
  friends: FriendUser[];
  incomingRequests: FriendUser[];
  outgoingRequests: FriendUser[];
  friendSearchResults: FriendUser[];
  conversations?: DmConversation[];
  unreadDm: Record<string, number>;
  friendSearch: string;
  incomingCall: IncomingCall | null;
  privateCallPeer: FriendUser | null;
  ringing: boolean;
  callTime: string;
  showScreenPicker: boolean;
  screenSources: ScreenSource[];
  screenPermission: string;
  showCreate: boolean;
  showJoin: boolean;
  newGuildName: string;
  joinCode: string;
  inviteGuildName: string;
  inviteToken: string;
  inviteCopied: boolean;
  labels: WorkspaceOverlayLabels;
  onTogglePeerMute: (peerId: string) => void;
  onPeerVolumeChange: (peerId: string, volume: number) => void;
  onInputChange: (deviceId: string) => void | Promise<void>;
  onOutputChange: (deviceId: string) => void | Promise<void>;
  onCameraChange: (deviceId: string) => void | Promise<void>;
  onScreenQualityChange: (quality: "720" | "1080") => void;
  onScreenFpsChange: (fps: 30 | 60) => void;
  onLobbySoundsChange: (enabled: boolean) => void;
  onEffectVolumeChange: (volume: number) => void;
  onCloseAudioSettings: () => void;
  onCloseFriends: () => void;
  onFriendSearchChange: (query: string) => void;
  onSearchFriends: () => void;
  onSendFriendRequest: (accountId: string) => void;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => void;
  onCancelFriendRequest: (friendshipId: string) => void;
  onOpenDm: (friend: FriendUser) => void;
  onCallFriend: (friend: FriendUser) => void;
  onRemoveFriend: (accountId: string) => void;
  onOpenConversation?: (conversation: DmConversation) => void;
  onCreateGroup?: (memberIds: string[]) => void;
  currentAccountId?: string;
  onGroupPromote?: (conversationId: string, accountId: string) => void;
  onGroupRemove?: (conversationId: string, accountId: string) => void;
  onGroupLeave?: (conversationId: string) => void;
  onAnswerCall: (accepted: boolean) => void | Promise<void>;
  onEndCall: () => void | Promise<void>;
  onCloseScreenPicker: () => void;
  onOpenSystemSettings: () => void | Promise<void>;
  onSelectScreenSource: (source: ScreenSource) => void | Promise<void>;
  onGuildNameChange: (name: string) => void;
  onCancelCreate: () => void;
  onCreateGuild: () => void | Promise<void>;
  onJoinCodeChange: (code: string) => void;
  onCancelJoin: () => void;
  onJoinGuild: () => void | Promise<void>;
  onCopyInvite: () => void | Promise<void>;
  onCloseInvite: () => void;
}) {
  return (
    <>
      <MembersPanel
        presence={presence}
        socketId={socketId}
        localSpeaking={localSpeaking}
        muted={muted}
        speakingPeers={speakingPeers}
        peerMuted={peerMuted}
        peerVolumes={peerVolumes}
        labels={labels.members}
        onTogglePeerMute={onTogglePeerMute}
        onPeerVolumeChange={onPeerVolumeChange}
      />

      {showAudioSettings && (
        <MediaSettingsModal
          audioInputs={audioInputs}
          audioOutputs={audioOutputs}
          videoInputs={videoInputs}
          selectedInput={selectedInput}
          selectedOutput={selectedOutput}
          selectedCamera={selectedCamera}
          screenQuality={screenQuality}
          screenFps={screenFps}
          lobbySoundsEnabled={lobbySoundsEnabled}
          effectVolume={effectVolume}
          labels={labels.media}
          onInputChange={onInputChange}
          onOutputChange={onOutputChange}
          onCameraChange={onCameraChange}
          onScreenQualityChange={onScreenQualityChange}
          onScreenFpsChange={onScreenFpsChange}
          onLobbySoundsChange={onLobbySoundsChange}
          onEffectVolumeChange={onEffectVolumeChange}
          onClose={onCloseAudioSettings}
        />
      )}

      {showFriends && (
        <FriendsModal
          friends={friends}
          incomingRequests={incomingRequests}
          outgoingRequests={outgoingRequests}
          friendSearchResults={friendSearchResults}
          conversations={conversations}
          unreadDm={unreadDm}
          searchQuery={friendSearch}
          labels={labels.friends}
          onClose={onCloseFriends}
          onSearchQueryChange={onFriendSearchChange}
          onSearch={onSearchFriends}
          onSendFriendRequest={onSendFriendRequest}
          onRespondFriendRequest={onRespondFriendRequest}
          onCancelFriendRequest={onCancelFriendRequest}
          onOpenDm={onOpenDm}
          onCallFriend={onCallFriend}
          onRemoveFriend={onRemoveFriend}
          onOpenConversation={onOpenConversation}
          onCreateGroup={onCreateGroup}
          currentAccountId={currentAccountId}
          onGroupPromote={onGroupPromote}
          onGroupRemove={onGroupRemove}
          onGroupLeave={onGroupLeave}
        />
      )}

      <CallAlerts
        incomingCall={incomingCall}
        privateCallPeer={privateCallPeer}
        ringing={ringing}
        callTime={callTime}
        labels={labels.calls}
        onAnswer={onAnswerCall}
        onEndCall={onEndCall}
      />

      {showScreenPicker && (
        <ScreenPicker
          sources={screenSources}
          permission={screenPermission}
          labels={labels.screen}
          onClose={onCloseScreenPicker}
          onOpenSystemSettings={onOpenSystemSettings}
          onSelectSource={onSelectScreenSource}
        />
      )}

      {showCreate && (
        <CreateGuildDialog
          name={newGuildName}
          labels={labels.guild}
          onNameChange={onGuildNameChange}
          onCancel={onCancelCreate}
          onCreate={onCreateGuild}
        />
      )}

      {showJoin && (
        <JoinGuildDialog
          code={joinCode}
          labels={labels.joinGuild}
          onCodeChange={onJoinCodeChange}
          onCancel={onCancelJoin}
          onJoin={onJoinGuild}
        />
      )}

      {inviteToken && (
        <InviteDialog
          guildName={inviteGuildName}
          token={inviteToken}
          copied={inviteCopied}
          labels={labels.invite}
          onCopy={onCopyInvite}
          onClose={onCloseInvite}
        />
      )}
    </>
  );
}
