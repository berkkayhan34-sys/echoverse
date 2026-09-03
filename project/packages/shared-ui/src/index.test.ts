/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ActionButton,
  CallAlerts,
  ChannelMessageList,
  ChannelThreadPanel,
  ChatComposer,
  CreateGuildDialog,
  DirectMessageComposer,
  DirectMessageInbox,
  DirectMessageHeader,
  DirectMessageThread,
  DirectMessageView,
  FriendsModal,
  GuildPicker,
  InviteDialog,
  LobbyStage,
  MediaSettingsModal,
  MembersPanel,
  PrivateCallStage,
  ScreenPicker,
  ServerTopbar,
  ServerView,
  VideoStage,
  VoiceControls,
  WorkspaceOverlays,
  WorkspaceSidebar
} from "./index.js";

describe("invite dialog", () => {
  it("renders the guild code and delegates copy/close actions", () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    const element = InviteDialog({
      guildName: "Private room",
      token: "invite-token",
      copied: false,
      labels: {
        title: "Invite {{guild}}",
        description: "Share code",
        copy: "Copy",
        copied: "Copied",
        close: "Close"
      },
      onCopy,
      onClose
    });

    expect(JSON.stringify(element)).toContain("Private room");
    expect(JSON.stringify(element)).toContain("invite-token");
    const buttons = elementsOfType(element, "button");
    (buttons.find((button) => buttonText(button) === "Copy")?.props.onClick as () => void)();
    (buttons.find((button) => buttonText(button) === "Close")?.props.onClick as () => void)();
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function elementsOfType(node: ReactNode, type: unknown): ReactElement[] {
  if (!isValidElement(node)) return [];
  const children = Children.toArray(node.props.children).flatMap((child) =>
    elementsOfType(child, type)
  );
  return node.type === type ? [node, ...children] : children;
}

function textContent(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement(node)) return textContent(node.props.children);
  return node == null ? "" : String(node);
}

function buttonText(button: ReactElement) {
  return Children.toArray(button.props.children).map(textContent).join("");
}

describe("shared chat UI", () => {
  it("renders catalog-supplied channel content and grapheme-safe initials", () => {
    const element = ChannelMessageList({
      messages: [
        {
          id: "message-1",
          username: "👩‍🔬Ada",
          text: "Merhaba",
          createdAt: "2026-08-27T00:00:00.000Z"
        }
      ],
      welcomeTitle: "Welcome",
      channelBeginning: "Beginning",
      formatDate: () => "formatted"
    });
    const children = Children.toArray(element.props.children);
    const message = children[1] as { props: { children: ReactNode } };
    const messageChildren = Children.toArray(message.props.children);
    const avatar = messageChildren[0] as { props: { children: unknown } };

    expect(element.type).toBe("section");
    expect(String(avatar.props.children)).toBe("👩‍🔬A");
    expect(children.join(" ")).not.toContain("undefined");
  });

  it("exposes message link and pin actions for a pinned message", () => {
    const onPin = vi.fn();
    const onCopyLink = vi.fn();
    const message = {
      id: "message-1",
      username: "Ada",
      text: "Merhaba",
      createdAt: "2026-08-27T00:00:00.000Z",
      pinned: true
    };
    const element = ChannelMessageList({
      messages: [message],
      welcomeTitle: "Welcome",
      channelBeginning: "Beginning",
      formatDate: () => "formatted",
      labels: {
        pin: "Pin message",
        unpin: "Unpin message",
        copyLink: "Copy message link",
        pinned: "Pinned",
        searchResults: "Search results",
        noSearchResults: "No messages found"
      },
      canManageMessages: true,
      onPin,
      onCopyLink
    });
    const buttons = elementsOfType(element, "button");
    const copyButton = buttons.find((button) => button.props["aria-label"] === "Copy message link");
    const unpinButton = buttons.find((button) => button.props["aria-label"] === "Unpin message");

    expect(JSON.stringify(element)).toContain("Pinned");
    expect(copyButton).toBeDefined();
    expect(unpinButton).toBeDefined();
    (copyButton?.props.onClick as () => void)();
    (unpinButton?.props.onClick as () => void)();
    expect(onCopyLink).toHaveBeenCalledWith(message);
    expect(onPin).toHaveBeenCalledWith(message);
  });

  it("exposes accessible input and action labels from the active catalog", () => {
    const onSend = vi.fn();
    const element = ChatComposer({
      text: "hello",
      inputLabel: "Message",
      placeholder: "Write a message",
      emojiLabel: "Add emoji",
      sendLabel: "Send",
      onTextChange: vi.fn(),
      onAddEmoji: vi.fn(),
      onSend
    });
    const input = elementsOfType(element, "input")[0];
    const emoji = elementsOfType(element, "summary")[0];
    const send = elementsOfType(element, ActionButton).find(
      (button) => buttonText(button) === "Send"
    );

    expect(input?.props["aria-label"]).toBe("Message");
    expect(emoji?.props["aria-label"]).toBe("Add emoji");
    expect(send).toBeDefined();
    expect(send?.props.disabled).toBe(false);
    (send?.props.onClick as () => void)();
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("keeps the send action inactive for an empty message", () => {
    const onSend = vi.fn();
    const element = ChatComposer({
      text: "   ",
      inputLabel: "Message",
      placeholder: "Write a message",
      emojiLabel: "Add emoji",
      sendLabel: "Send",
      onTextChange: vi.fn(),
      onAddEmoji: vi.fn(),
      onSend
    });
    const input = elementsOfType(element, "input")[0];
    const send = elementsOfType(element, ActionButton).find(
      (button) => buttonText(button) === "Send"
    );

    expect(send?.props.disabled).toBe(true);
    (input?.props.onKeyDown as (event: { key: string }) => void)({ key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("offers authorized member suggestions for a trailing mention", () => {
    const onTextChange = vi.fn();
    const element = ChatComposer({
      text: "hello @Al",
      inputLabel: "Message",
      placeholder: "Write a message",
      emojiLabel: "Add emoji",
      mentionLabel: "Mention a member",
      sendLabel: "Send",
      mentionCandidates: [
        { accountId: "account-1", username: "Alice", avatarData: null },
        { accountId: "account-2", username: "Bob", avatarData: null }
      ],
      onTextChange,
      onAddEmoji: vi.fn(),
      onSend: vi.fn()
    });
    const suggestions = elementsOfType(element, "button").filter(
      (button) => button.props.className === "mention-suggestion"
    );

    expect(suggestions).toHaveLength(1);
    expect(textContent(suggestions[0])).toContain("@Alice");
    (suggestions[0]?.props.onClick as () => void)();
    expect(onTextChange).toHaveBeenCalledWith("hello @Alice ");
  });

  it("renders a channel reply context and delegates clear/reply actions", () => {
    const onReply = vi.fn();
    const onClearReply = vi.fn();
    const parent = {
      id: "message-1",
      username: "Ada",
      text: "Original message",
      createdAt: "2026-08-27T00:00:00.000Z"
    };
    const reply = {
      id: "message-2",
      username: "Lin",
      text: "Reply message",
      createdAt: "2026-08-27T00:01:00.000Z",
      replyToId: parent.id
    };
    const list = ChannelMessageList({
      messages: [parent, reply],
      welcomeTitle: "Welcome",
      channelBeginning: "Beginning",
      formatDate: () => "formatted",
      labels: {
        reply: "Reply",
        pin: "Pin message",
        unpin: "Unpin message",
        copyLink: "Copy message link",
        pinned: "Pinned",
        searchResults: "Search results",
        noSearchResults: "No messages found"
      },
      onReply
    });
    const replyButtons = elementsOfType(list, "button").filter(
      (button) => button.props["aria-label"] === "Reply"
    );

    expect(textContent(list)).toContain("Ada: Original message");
    expect(replyButtons).toHaveLength(2);
    (replyButtons[1]?.props.onClick as () => void)();
    expect(onReply).toHaveBeenCalledWith(reply);

    const composer = ChatComposer({
      text: "",
      inputLabel: "Message",
      placeholder: "Write a message",
      emojiLabel: "Add emoji",
      sendLabel: "Send",
      replyingTo: { username: parent.username, text: parent.text },
      clearReplyLabel: "Clear reply",
      onClearReply,
      onTextChange: vi.fn(),
      onAddEmoji: vi.fn(),
      onSend: vi.fn()
    });
    const clearButton = elementsOfType(composer, "button").find(
      (button) => button.props["aria-label"] === "Clear reply"
    );
    expect(textContent(composer)).toContain("Ada: Original message");
    (clearButton?.props.onClick as () => void)();
    expect(onClearReply).toHaveBeenCalledOnce();
  });

  it("groups persisted replies in a focused thread panel", () => {
    const onReply = vi.fn();
    const onClose = vi.fn();
    const root = {
      id: "root",
      username: "Ada",
      text: "Root message",
      createdAt: "2026-08-27T00:00:00.000Z"
    };
    const reply = {
      id: "reply",
      username: "Lin",
      text: "First reply",
      createdAt: "2026-08-27T00:01:00.000Z",
      replyToId: root.id
    };
    const nested = {
      id: "nested",
      username: "Ada",
      text: "Nested reply",
      createdAt: "2026-08-27T00:02:00.000Z",
      replyToId: reply.id
    };
    const panel = ChannelThreadPanel({
      root,
      messages: [root, reply, nested],
      labels: {
        title: "Thread",
        close: "Close thread",
        reply: "Reply",
        noReplies: "No replies yet"
      },
      formatDate: () => "formatted",
      onReply,
      onClose
    });
    const buttons = elementsOfType(panel, "button");

    expect(textContent(panel)).toContain("Root message");
    expect(textContent(panel)).toContain("First reply");
    expect(textContent(panel)).toContain("Nested reply");
    expect(buttons).toHaveLength(4);
    (buttons[0]?.props.onClick as () => void)();
    (buttons[1]?.props.onClick as () => void)();
    (buttons[2]?.props.onClick as () => void)();
    (buttons[3]?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onReply).toHaveBeenCalledWith(root);
    expect(onReply).toHaveBeenCalledWith(reply);
    expect(onReply).toHaveBeenCalledWith(nested);
  });

  it("keeps direct-message actions and search rendering inside the shared boundary", () => {
    const onReply = vi.fn();
    const message = {
      id: "dm-1",
      senderId: "account-1",
      recipientId: "account-2",
      body: "hello",
      createdAt: "2026-08-27T00:00:00.000Z",
      reactions: { "👍": ["account-2"] }
    };
    const element = DirectMessageThread({
      messages: [message],
      query: "hello",
      currentAccountId: "account-1",
      currentUsername: "Ada",
      peer: { username: "Lin" },
      labels: {
        today: "Today",
        emptyConversation: "Beginning",
        deletedReply: "Deleted",
        deletedMessage: "Message deleted.",
        message: "Message",
        edited: "(edited)",
        download: "Download",
        reply: "Reply",
        edit: "Edit",
        delete: "Delete"
      },
      formatDate: () => "Aug 27",
      formatTime: () => "12:00",
      onReply,
      onReact: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDownloadAttachment: vi.fn(),
      onOpenAttachment: vi.fn()
    });
    const buttons = elementsOfType(element, "button");
    const replyButton = buttons.find((button) => buttonText(button).includes("Reply"));

    expect(buttons.some((button) => buttonText(button).includes("👍 1"))).toBe(true);
    expect(replyButton).toBeDefined();
    (replyButton?.props.onClick as () => void)();
    expect(onReply).toHaveBeenCalledWith(message);
  });

  it("exposes localized direct-message composer context and callbacks", () => {
    const onSend = vi.fn();
    const onClearContext = vi.fn();
    const element = DirectMessageComposer({
      text: "draft",
      inputLabel: "Message",
      placeholder: "Edit message",
      fileLabel: "Send file",
      clearLabel: "Clear context",
      dragHint: "Drop the file here",
      sendLabel: "Save",
      editingLabel: "Editing message",
      attachmentReadyLabel: "photo.png ready to send",
      dragActive: true,
      fileInputRef: { current: null },
      onFileSelected: vi.fn(),
      onDropFile: vi.fn(),
      onDragActiveChange: vi.fn(),
      onTextChange: vi.fn(),
      onTypingChange: vi.fn(),
      onSend,
      onClearContext
    });
    const buttons = elementsOfType(element, ActionButton);
    const clearButton = buttons.find((button) => button.props["aria-label"] === "Clear context");
    const sendButton = buttons.find((button) => buttonText(button).includes("Save"));

    expect(elementsOfType(element, "input")).toHaveLength(1);
    expect(elementsOfType(element, "textarea")).toHaveLength(1);
    expect(
      elementsOfType(element, "div").some((node) => node.props.children === "Drop the file here")
    ).toBe(true);
    (clearButton?.props.onClick as () => void)();
    (sendButton?.props.onClick as () => void)();
    expect(onClearContext).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("composes the direct-message screen without owning renderer effects", () => {
    const onBack = vi.fn();
    const onSend = vi.fn();
    const labels = {
      header: {
        back: "Back",
        block: "Block",
        searchPlaceholder: "Search",
        calling: "Calling",
        call: "Call",
        endCall: "End call"
      },
      call: {
        incoming: "Incoming",
        ringing: "Ringing",
        privateConversation: (time: string) => `Private conversation ${time}`,
        microphone: "Microphone",
        mute: "Mute",
        unmute: "Unmute",
        deafen: "Deafen",
        undeafen: "Undeafen",
        pushToTalkTitle: "Push to talk",
        speaking: "Speaking",
        pressToTalk: "Press to talk",
        voiceActivity: "Voice activity",
        close: "Close"
      },
      thread: {
        today: "Today",
        emptyConversation: "Start",
        deletedReply: "Deleted",
        deletedMessage: "Deleted message",
        message: "Message",
        edited: "Edited",
        download: "Download",
        reply: "Reply",
        edit: "Edit",
        delete: "Delete"
      },
      composer: {
        inputLabel: "Message",
        messagePlaceholder: "Write",
        editPlaceholder: "Edit",
        fileLabel: "File",
        clearLabel: "Clear",
        dragHint: "Drop",
        sendLabel: "Send",
        saveLabel: "Save"
      }
    };
    const element = DirectMessageView({
      peer: { id: "account-2", username: "Lin", status: "online" },
      statusLabel: "Online",
      searchQuery: "",
      callState: "idle",
      callTime: "",
      muted: false,
      deafened: false,
      pushToTalk: false,
      pttPressed: false,
      messages: [],
      currentAccountId: "account-1",
      currentUsername: "Ada",
      text: "",
      dragActive: false,
      labels,
      formatDate: () => "date",
      formatTime: () => "time",
      onBack,
      onSearchQueryChange: vi.fn(),
      onBlock: vi.fn(),
      onCall: vi.fn(),
      onToggleMute: vi.fn(),
      onToggleDeafen: vi.fn(),
      onTogglePushToTalk: vi.fn(),
      onEndCall: vi.fn(),
      onReply: vi.fn(),
      onReact: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDownloadAttachment: vi.fn(),
      onOpenAttachment: vi.fn(),
      onFileSelected: vi.fn(),
      onDropFile: vi.fn(),
      onDragActiveChange: vi.fn(),
      onTextChange: vi.fn(),
      onTypingChange: vi.fn(),
      onSend,
      onClearContext: vi.fn()
    });
    const header = elementsOfType(element, DirectMessageHeader)[0];
    const composer = elementsOfType(element, DirectMessageComposer)[0];

    expect(element.props.className).toBe("dm-fullpage");
    expect(elementsOfType(element, DirectMessageThread)).toHaveLength(1);
    expect(elementsOfType(element, PrivateCallStage)).toHaveLength(0);
    (header?.props.onBack as () => void)();
    (composer?.props.onSend as () => void)();
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("keeps guild selection and dialog actions inside the shared boundary", () => {
    const onSelectGuild = vi.fn();
    const onCreateGuild = vi.fn();
    const onJoinGuildByCode = vi.fn();
    const guild = {
      id: "guild-1",
      name: "👩‍🔬 Lab",
      createdBy: "account-1",
      createdAt: "2026-08-27T00:00:00.000Z"
    };
    const element = GuildPicker({
      guilds: [guild],
      labels: {
        title: "Guilds",
        choose: "Choose a guild",
        joinByCode: "Join by code",
        newGuild: "New guild",
        joinGuild: "Join guild",
        namePlaceholder: "Guild name",
        codePlaceholder: "Invite code",
        cancel: "Cancel",
        createAction: "Create",
        joinAction: "Join",
        guildCode: (id) => `Code ${id}`
      },
      showCreate: true,
      showJoin: false,
      newGuildName: "",
      joinCode: "",
      error: "",
      onCreateOpen: vi.fn(),
      onJoinOpen: vi.fn(),
      onCreateClose: vi.fn(),
      onJoinClose: vi.fn(),
      onNewGuildNameChange: vi.fn(),
      onJoinCodeChange: vi.fn(),
      onCreateGuild,
      onJoinGuildByCode,
      onSelectGuild
    });
    const buttons = elementsOfType(element, "button");
    const guildButton = buttons[1];
    const createDialog = elementsOfType(element, CreateGuildDialog)[0];

    expect(textContent(guildButton)).toContain("👩‍🔬 Lab");
    (guildButton?.props.onClick as () => void)();
    (createDialog?.props.onCreate as () => void)();
    (createDialog?.props.onNameChange as (value: string) => void)("New guild");
    expect(onSelectGuild).toHaveBeenCalledWith(guild);
    expect(onCreateGuild).toHaveBeenCalledOnce();
    expect(onJoinGuildByCode).not.toHaveBeenCalled();
  });

  it("keeps friend actions catalog-driven and scoped to the selected account", () => {
    const onOpenDm = vi.fn();
    const onRespond = vi.fn();
    const onCall = vi.fn();
    const onRemove = vi.fn();
    const friend = { id: "account-2", username: "Lin", friendshipId: "friendship-1" };
    const element = FriendsModal({
      friends: [friend],
      incomingRequests: [friend],
      outgoingRequests: [],
      friendSearchResults: [friend],
      unreadDm: { "account-2": 3 },
      searchQuery: "Lin",
      labels: {
        title: "Friends",
        close: "Close",
        searchPlaceholder: "Search by username",
        search: "Search",
        searchResults: "Search results",
        incomingRequests: "Incoming requests",
        outgoingRequests: "Pending requests",
        myFriends: "My friends",
        noFriends: "No friends",
        add: "Add",
        accept: "Accept",
        decline: "Reject",
        openDirectMessage: "Open direct message",
        call: "Call",
        remove: "Remove"
      },
      onClose: vi.fn(),
      onSearchQueryChange: vi.fn(),
      onSearch: vi.fn(),
      onSendFriendRequest: vi.fn(),
      onRespondFriendRequest: onRespond,
      onCancelFriendRequest: vi.fn(),
      onOpenDm,
      onCallFriend: onCall,
      onRemoveFriend: onRemove
    });
    const buttons = elementsOfType(element, "button");
    const byLabel = (label: string) =>
      buttons.find((button) => button.props["aria-label"] === label);
    const byText = (value: string) => buttons.find((button) => buttonText(button).includes(value));

    expect(byText("3")).toBeDefined();
    (byLabel("Accept")?.props.onClick as () => void)();
    (byLabel("Reject")?.props.onClick as () => void)();
    (byLabel("Open direct message")?.props.onClick as () => void)();
    (byLabel("Call")?.props.onClick as () => void)();
    (byLabel("Remove")?.props.onClick as () => void)();
    expect(onRespond).toHaveBeenNthCalledWith(1, "friendship-1", true);
    expect(onRespond).toHaveBeenNthCalledWith(2, "friendship-1", false);
    expect(onOpenDm).toHaveBeenCalledWith(friend);
    expect(onCall).toHaveBeenCalledWith(friend);
    expect(onRemove).toHaveBeenCalledWith("account-2");
  });

  it("renders message requests and delegates accept, decline, and spam", () => {
    const onRespondMessageRequest = vi.fn();
    const element = FriendsModal({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      incomingMessageRequests: [
        {
          id: "dm-request-1",
          senderId: "account-2",
          recipientId: "account-1",
          senderUsername: "Lin",
          senderAvatarData: null,
          recipientUsername: "Berk",
          recipientAvatarData: null,
          body: "hello",
          status: "pending",
          createdAt: "2026-08-31T00:00:00.000Z",
          updatedAt: "2026-08-31T00:00:00.000Z"
        }
      ],
      outgoingMessageRequests: [],
      friendSearchResults: [],
      unreadDm: {},
      searchQuery: "",
      labels: {
        title: "Friends",
        close: "Close",
        searchPlaceholder: "Search by username",
        search: "Search",
        searchResults: "Search results",
        incomingRequests: "Incoming requests",
        outgoingRequests: "Pending requests",
        messageRequests: "Message requests",
        messageRequestAccept: "Accept message",
        messageRequestDecline: "Decline message",
        messageRequestSpam: "Mark as spam",
        myFriends: "My friends",
        noFriends: "No friends",
        add: "Add",
        accept: "Accept",
        decline: "Reject",
        openDirectMessage: "Open direct message",
        call: "Call",
        remove: "Remove"
      },
      onClose: vi.fn(),
      onSearchQueryChange: vi.fn(),
      onSearch: vi.fn(),
      onSendFriendRequest: vi.fn(),
      onRespondFriendRequest: vi.fn(),
      onCancelFriendRequest: vi.fn(),
      onOpenDm: vi.fn(),
      onCallFriend: vi.fn(),
      onRemoveFriend: vi.fn(),
      onRespondMessageRequest
    });

    const buttons = elementsOfType(element, "button");
    (
      buttons.find((button) => button.props["aria-label"] === "Accept message")?.props
        .onClick as () => void
    )();
    (
      buttons.find((button) => button.props["aria-label"] === "Decline message")?.props
        .onClick as () => void
    )();
    (
      buttons.find((button) => button.props["aria-label"] === "Mark as spam")?.props
        .onClick as () => void
    )();

    expect(textContent(element)).toContain("hello");
    expect(onRespondMessageRequest).toHaveBeenNthCalledWith(1, "dm-request-1", "accept");
    expect(onRespondMessageRequest).toHaveBeenNthCalledWith(2, "dm-request-1", "decline");
    expect(onRespondMessageRequest).toHaveBeenNthCalledWith(3, "dm-request-1", "spam");
  });

  it("keeps screen-source selection and permission actions renderer-owned", () => {
    const onSelectSource = vi.fn();
    const source = { id: "screen-1", name: "Main display" };
    const element = ScreenPicker({
      sources: [source],
      permission: "denied",
      labels: {
        title: "Share screen",
        chooseSource: "Choose a source",
        close: "Close",
        permissionOff: "Permission is required",
        openSystemSettings: "Open system settings"
      },
      onClose: vi.fn(),
      onOpenSystemSettings: vi.fn(),
      onSelectSource
    });
    const buttons = elementsOfType(element, "button");
    const sourceButton = buttons.find((button) => buttonText(button).includes("Main display"));

    expect(elementsOfType(element, "img")).toHaveLength(0);
    (sourceButton?.props.onClick as () => void)();
    expect(onSelectSource).toHaveBeenCalledWith(source);
  });

  it("keeps incoming and active call controls catalog-driven", () => {
    const onAnswer = vi.fn();
    const onEndCall = vi.fn();
    const element = CallAlerts({
      incomingCall: {
        callId: "call-1",
        fromAccountId: "account-2",
        fromSocketId: "socket-2",
        fromUsername: "👩‍🔬 Lin"
      },
      privateCallPeer: { id: "account-2", username: "👩‍🔬 Lin" },
      ringing: false,
      callTime: "00:42",
      labels: {
        incomingPrivateCall: "Incoming private call",
        answer: "Answer",
        reject: "Reject",
        endCall: "End call",
        ringing: "Ringing",
        privateConversation: (time) => `Private conversation · ${time}`
      },
      onAnswer,
      onEndCall
    });
    const buttons = elementsOfType(element, "button");

    (
      buttons.find((button) => button.props["aria-label"] === "Answer")?.props.onClick as () => void
    )();
    (
      buttons.find((button) => button.props["aria-label"] === "Reject")?.props.onClick as () => void
    )();
    (
      buttons.find((button) => buttonText(button).includes("End call"))?.props.onClick as () => void
    )();
    expect(onAnswer).toHaveBeenNthCalledWith(1, true);
    expect(onAnswer).toHaveBeenNthCalledWith(2, false);
    expect(onEndCall).toHaveBeenCalledOnce();
    expect(textContent(element)).toContain("Private conversation · 00:42");
  });

  it("keeps workspace navigation and profile controls inside the shared boundary", () => {
    const onSelectGuild = vi.fn();
    const onCreateGuild = vi.fn();
    const onLeaveGuild = vi.fn();
    const onOpenSettings = vi.fn();
    const onTogglePeerMute = vi.fn();
    const onPeerVolumeChange = vi.fn();
    const onSetNotificationLevel = vi.fn();
    const onMarkChannelRead = vi.fn();
    const guild = { id: "echoverse", name: "EchoVerse", createdBy: "account-1", createdAt: "now" };
    const privateGuild = {
      id: "guild-1",
      name: "Private room",
      createdBy: "account-2",
      createdAt: "now",
      role: "member" as const
    };
    const element = WorkspaceSidebar({
      guilds: [guild, privateGuild],
      activeGuild: guild,
      presence: [
        { socketId: "socket-1", userId: "account-1", username: "Ada" },
        { socketId: "socket-2", userId: "account-2", username: "Lin" }
      ],
      socketId: "socket-1",
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      peerMuted: {},
      peerVolumes: {},
      account: { id: "account-1", email: "ada@example.com", username: "Ada" },
      username: "Ada",
      appVersion: "1.7.5",
      labels: {
        appName: "EchoVerse",
        textChannels: "TEXT CHANNELS",
        general: "general",
        music: "music",
        voiceChannels: "VOICE CHANNELS",
        lobby: "Lobby",
        self: " (you)",
        muteOnlyYou: "Mute for you only",
        changeAvatar: "Change profile photo",
        voiceConnected: (version) => `Voice connected · v${version}`,
        microphone: "Microphone",
        settings: "Settings",
        logout: "Sign out",
        createGuild: "New server",
        leaveGuild: "Leave server",
        moreOptions: "More server options"
      },
      onSelectGuild,
      onCreateGuild,
      onLeaveGuild,
      channels: [
        {
          id: "echoverse:general",
          guildId: "echoverse",
          name: "general",
          type: "text",
          categoryId: null,
          position: 0,
          archived: false,
          createdAt: "now"
        }
      ],
      notificationUnread: { "echoverse:general": 4 },
      notificationLevels: { "echoverse:general": "all" },
      onSetNotificationLevel,
      onMarkChannelRead,
      onTogglePeerMute,
      onPeerVolumeChange,
      onChangeAvatar: vi.fn(),
      onToggleMute: vi.fn(),
      onOpenSettings,
      onLogout: vi.fn()
    });
    const buttons = elementsOfType(element, "button");
    const createButton = buttons.find((button) => button.props["aria-label"] === "New server");
    const peerMuteButton = buttons.find(
      (button) => button.props["aria-label"] === "Mute for you only"
    );
    const peerVolume = elementsOfType(element, "input").find(
      (input) => input.props["aria-label"] === "Lin"
    );
    const settingsButton = buttons.find((button) => button.props["aria-label"] === "Settings");

    (createButton?.props.onClick as () => void)();
    (settingsButton?.props.onClick as () => void)();
    (peerMuteButton?.props.onClick as () => void)();
    (peerVolume?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "150" }
    });
    expect(onCreateGuild).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onTogglePeerMute).toHaveBeenCalledWith("socket-2");
    expect(onPeerVolumeChange).toHaveBeenCalledWith("socket-2", 150);

    const summaries = elementsOfType(element, "summary");
    expect(summaries).toHaveLength(2);
    expect(
      summaries.find((summary) => summary.props["aria-label"]?.includes("Private room"))
    ).toBeTruthy();
    const leaveButton = buttons.find((button) => buttonText(button) === "Leave server");
    const removeAttribute = vi.fn();
    (leaveButton?.props.onClick as (event: unknown) => void)({
      currentTarget: { closest: () => ({ removeAttribute }) }
    });
    expect(removeAttribute).toHaveBeenCalledWith("open");
    expect(onLeaveGuild).toHaveBeenCalledWith(privateGuild);
    const unread = elementsOfType(element, "span").find(
      (span) => span.props.className === "channel-unread-badge"
    );
    expect(unread?.props.children).toBe(4);
    const notificationButton = buttons.find(
      (button) => button.props.className === "channel-notification-toggle"
    );
    (notificationButton?.props.onClick as (event: { stopPropagation: () => void }) => void)({
      stopPropagation: vi.fn()
    });
    expect(onSetNotificationLevel).toHaveBeenCalledWith("echoverse:general", "none");
    const channelButton = buttons.find((button) => buttonText(button).includes("# general"));
    (channelButton?.props.onClick as () => void)();
    expect(onMarkChannelRead).toHaveBeenCalledWith("echoverse:general");
  });

  it("renders the server-backed DM privacy toggle", () => {
    const onUpdatePrivacy = vi.fn();
    const element = FriendsModal({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      friendSearchResults: [],
      unreadDm: {},
      searchQuery: "",
      allowNonFriendRequests: true,
      labels: {
        title: "Friends",
        close: "Close",
        searchPlaceholder: "Search",
        search: "Search",
        searchResults: "Results",
        incomingRequests: "Incoming",
        outgoingRequests: "Outgoing",
        myFriends: "Friends",
        noFriends: "No friends",
        add: "Add",
        accept: "Accept",
        decline: "Decline",
        openDirectMessage: "Open direct message",
        call: "Call",
        remove: "Remove",
        privacyTitle: "DM privacy",
        allowNonFriendRequests: "Allow requests",
        privacyDescription: "Quarantine strangers"
      },
      onClose: vi.fn(),
      onSearchQueryChange: vi.fn(),
      onSearch: vi.fn(),
      onSendFriendRequest: vi.fn(),
      onRespondFriendRequest: vi.fn(),
      onCancelFriendRequest: vi.fn(),
      onOpenDm: vi.fn(),
      onCallFriend: vi.fn(),
      onRemoveFriend: vi.fn(),
      onUpdatePrivacy
    });
    const inputs = elementsOfType(element, "input");
    const toggle = inputs.find((input) => input.props.type === "checkbox");
    expect(toggle?.props.checked).toBe(true);
    (toggle?.props.onChange as (event: { target: { checked: boolean } }) => void)({
      target: { checked: false }
    });
    expect(onUpdatePrivacy).toHaveBeenCalledWith(false);
  });
});

describe("DM inbox", () => {
  it("renders searchable friends and group conversations with unread badges", () => {
    const onOpenDm = vi.fn();
    const onOpenConversation = vi.fn();
    const element = DirectMessageInbox({
      friends: [{ id: "friend-1", username: "Ada", status: "online" }],
      conversations: [
        {
          id: "group-1",
          kind: "group",
          name: "Study group",
          createdBy: "friend-1",
          createdAt: "2026-08-31T00:00:00.000Z",
          members: [
            { accountId: "me", username: "Me", role: "owner" },
            { accountId: "friend-1", username: "Ada", role: "member" }
          ]
        }
      ],
      unread: { "friend-1": 2, "group-1": 4 },
      searchQuery: "",
      currentAccountId: "me",
      labels: {
        title: "Direct messages",
        searchPlaceholder: "Search conversations",
        friends: "Friends",
        groups: "Groups",
        messageRequests: "Message requests",
        openFriends: "Friends",
        noFriends: "No friends",
        noConversations: "No conversations",
        memberCount: (count) => `${count} members`,
        mentions: "Mentions"
      },
      onSearchQueryChange: vi.fn(),
      onOpenFriends: vi.fn(),
      onOpenDm,
      onOpenConversation
    });
    expect(textContent(element)).toContain("Ada");
    expect(textContent(element)).toContain("Study group");
    expect(textContent(element)).toContain("2");
    const buttons = elementsOfType(element, "button");
    buttons.find((button) => buttonText(button).includes("Ada"))?.props.onClick();
    buttons.find((button) => buttonText(button).includes("Study group"))?.props.onClick();
    expect(onOpenDm).toHaveBeenCalledOnce();
    expect(onOpenConversation).toHaveBeenCalledOnce();
  });

  it("exposes peer mute and archive controls without changing conversation navigation", () => {
    const onOpenDm = vi.fn();
    const onUpdatePeerPreference = vi.fn();
    const element = DirectMessageInbox({
      friends: [{ id: "friend-1", username: "Ada", status: "online" }],
      conversations: [],
      unread: {},
      preferences: { "friend-1": { peerId: "friend-1", muted: false, archived: true } },
      searchQuery: "",
      labels: {
        title: "Direct messages",
        searchPlaceholder: "Search conversations",
        friends: "Friends",
        groups: "Groups",
        messageRequests: "Message requests",
        openFriends: "Friends",
        noFriends: "No friends",
        noConversations: "No conversations",
        memberCount: (count) => `${count} members`,
        mentions: "Mentions",
        mute: "Mute notifications",
        unmute: "Unmute notifications",
        archive: "Archive conversation",
        unarchive: "Unarchive conversation"
      },
      onSearchQueryChange: vi.fn(),
      onOpenFriends: vi.fn(),
      onOpenDm,
      onOpenConversation: vi.fn(),
      onUpdatePeerPreference
    });

    const buttons = elementsOfType(element, "button");
    expect(buttons.some((button) => button.props["aria-label"] === "Mute notifications")).toBe(
      true
    );
    expect(buttons.some((button) => button.props["aria-label"] === "Unarchive conversation")).toBe(
      true
    );
    const unmute = buttons.find((button) => button.props["aria-label"] === "Mute notifications");
    const unarchive = buttons.find(
      (button) => button.props["aria-label"] === "Unarchive conversation"
    );
    (unmute?.props.onClick as () => void)();
    (unarchive?.props.onClick as () => void)();
    expect(onUpdatePeerPreference).toHaveBeenNthCalledWith(1, "friend-1", { muted: true });
    expect(onUpdatePeerPreference).toHaveBeenNthCalledWith(2, "friend-1", { archived: false });
    const row = buttons.find((button) => buttonText(button).includes("Ada"));
    (row?.props.onClick as () => void)();
    expect(onOpenDm).toHaveBeenCalledWith(expect.objectContaining({ id: "friend-1" }));
  });
});

describe("shared media settings UI", () => {
  it("keeps device labels localized and sends preference changes to the renderer", () => {
    const onInputChange = vi.fn();
    const onScreenQualityChange = vi.fn();
    const onLobbySoundsChange = vi.fn();
    const device = (deviceId: string, label: string): MediaDeviceInfo =>
      ({ deviceId, label, kind: "audioinput" }) as MediaDeviceInfo;
    const element = MediaSettingsModal({
      audioInputs: [device("mic001", "")],
      audioOutputs: [device("output-1", "Speakers")],
      videoInputs: [device("cam001", "")],
      selectedInput: "",
      selectedOutput: "output-1",
      selectedCamera: "",
      screenQuality: "720",
      screenFps: 30,
      lobbySoundsEnabled: true,
      effectVolume: 70,
      labels: {
        title: "Audio and video",
        description: "Choose devices",
        microphoneInput: "Microphone",
        speakerOutput: "Speaker",
        speakerFallback: (id) => `Speaker ${id}`,
        systemDefault: "System default",
        videoSection: "Video",
        cameraInput: "Camera",
        microphoneFallback: (id) => `Microphone ${id}`,
        cameraFallback: (id) => `Camera ${id}`,
        screenQualityLabel: "Quality",
        quality: (quality) => `${quality}p`,
        fps: "FPS",
        shareProfile: (quality, fps) => `${quality}p ${fps} FPS`,
        changeNotice: "Applies next share",
        lobbySounds: "Lobby sounds",
        lobbySoundsDescription: "Play join sounds",
        effectVolume: (volume) => `Volume ${volume}%`,
        close: "Close"
      },
      onInputChange,
      onOutputChange: vi.fn(),
      onCameraChange: vi.fn(),
      onScreenQualityChange,
      onScreenFpsChange: vi.fn(),
      onLobbySoundsChange,
      onEffectVolumeChange: vi.fn(),
      onClose: vi.fn()
    });
    const selects = elementsOfType(element, "select");
    const checkbox = elementsOfType(element, "input").find(
      (input) => input.props.type === "checkbox"
    );

    expect(textContent(element)).toContain("Microphone mic001");
    expect(textContent(element)).toContain("Camera cam001");
    (selects[0]?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "mic001" }
    });
    (selects[3]?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "1080" }
    });
    (checkbox?.props.onChange as (event: { target: { checked: boolean } }) => void)({
      target: { checked: false }
    });
    expect(onInputChange).toHaveBeenCalledWith("mic001");
    expect(onScreenQualityChange).toHaveBeenCalledWith("1080");
    expect(onLobbySoundsChange).toHaveBeenCalledWith(false);
  });
});

describe("shared members UI", () => {
  it("keeps peer controls accessible and localizes the muted state", () => {
    const onTogglePeerMute = vi.fn();
    const onPeerVolumeChange = vi.fn();
    const element = MembersPanel({
      presence: [
        { socketId: "self", userId: "account-1", username: "Ada" },
        { socketId: "peer", userId: "account-2", username: "Lin" }
      ],
      socketId: "self",
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      peerMuted: { peer: true },
      peerVolumes: { peer: 80 },
      labels: {
        onlineCount: (count) => `ONLINE ${count}`,
        botsCount: "BOTS — 1",
        self: " (you)",
        muteOnlyYou: "Mute for you only",
        muted: "MUTED",
        volumeFor: (username) => `Volume for ${username}`,
        botName: "EchoBot",
        botHelp: "!help"
      },
      onTogglePeerMute,
      onPeerVolumeChange
    });
    const muteButton = elementsOfType(element, "button").find(
      (button) => button.props["aria-label"] === "Mute for you only"
    );
    const volume = elementsOfType(element, "input").find(
      (input) => input.props["aria-label"] === "Volume for Lin"
    );

    expect(textContent(element)).toContain("MUTED");
    (muteButton?.props.onClick as () => void)();
    (volume?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "120" }
    });
    expect(onTogglePeerMute).toHaveBeenCalledWith("peer");
    expect(onPeerVolumeChange).toHaveBeenCalledWith("peer", 120);
  });
});

describe("shared video controls", () => {
  it("keeps layout and media actions renderer-owned", () => {
    const onLayoutChange = vi.fn();
    const onToggleMute = vi.fn();
    const onToggleCamera = vi.fn();
    const onToggleScreen = vi.fn();
    const onEndCall = vi.fn();
    const stage = VideoStage({
      layout: "grid",
      status: "Video off",
      localVideoRef: { current: null },
      remoteVideoHostRef: { current: null },
      localVideoActive: true,
      localSpeaking: true,
      muted: false,
      labels: { videoShare: "Video & sharing", grid: "Grid", focus: "Focus" },
      onLayoutChange
    });
    const controls = VoiceControls({
      muted: false,
      cameraOn: false,
      screenOn: false,
      connected: true,
      labels: {
        mute: "Mute",
        microphone: "Microphone",
        camera: "Camera",
        cameraOff: "Camera off",
        screenShare: "Share screen",
        stopScreenShare: "Stop sharing",
        endCall: "End call",
        online: "Online",
        offline: "Offline"
      },
      onToggleMute,
      onToggleCamera,
      onToggleScreen,
      onEndCall
    });
    const stageButtons = elementsOfType(stage, "button");
    const controlButtons = elementsOfType(controls, "button");

    expect(textContent(stage)).toContain("Video off");
    expect(elementsOfType(stage, "video")[0]?.props.className).toContain("speaking-video");
    (stageButtons[1]?.props.onClick as () => void)();
    controlButtons.forEach((button) => (button.props.onClick as () => void)());
    expect(onLayoutChange).toHaveBeenCalledWith("focus");
    expect(onToggleMute).toHaveBeenCalledOnce();
    expect(onToggleCamera).toHaveBeenCalledOnce();
    expect(onToggleScreen).toHaveBeenCalledOnce();
    expect(onEndCall).toHaveBeenCalledOnce();
  });
});

describe("shared lobby stage", () => {
  it("renders an empty state and live participant cards from voice presence", () => {
    const labels = {
      subtitle: "Talk together",
      participants: (count: number) => `${count} participants`,
      emptyTitle: "No one is here yet",
      emptyDescription: "Join the voice channel",
      speaking: "Speaking",
      muted: "Muted"
    };
    const empty = LobbyStage({
      channelName: "Lobby",
      presence: [],
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      labels
    });

    expect(textContent(empty)).toContain("No one is here yet");

    const live = LobbyStage({
      channelName: "Lobby",
      presence: [
        { socketId: "socket-1", userId: "account-1", username: "Ada", avatarData: null },
        { socketId: "socket-2", userId: "account-2", username: "Lin", avatarData: null }
      ],
      socketId: "socket-1",
      localSpeaking: true,
      muted: false,
      speakingPeers: {},
      labels
    });

    expect(textContent(live)).toContain("2 participants");
    expect(textContent(live)).toContain("Ada");
    expect(textContent(live)).toContain("Speaking");
  });

  it("renders lobby media controls through renderer-owned callbacks", () => {
    const onToggleMute = vi.fn();
    const onToggleCamera = vi.fn();
    const onToggleScreen = vi.fn();
    const onEndCall = vi.fn();
    const element = LobbyStage({
      channelName: "Lobby",
      presence: [],
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      connected: true,
      controlsVisible: true,
      cameraOn: false,
      screenOn: false,
      onToggleMute,
      onToggleCamera,
      onToggleScreen,
      onEndCall,
      labels: {
        subtitle: "Talk together",
        participants: (count: number) => `${count} participants`,
        emptyTitle: "No one is here yet",
        emptyDescription: "Join the voice channel",
        speaking: "Speaking",
        muted: "Muted",
        controls: {
          microphone: "Microphone",
          mute: "Mute",
          camera: "Camera",
          cameraOff: "Camera off",
          screenShare: "Share screen",
          stopScreenShare: "Stop sharing",
          endCall: "End call",
          addParticipant: "Add participant",
          mediaSettings: "Audio settings"
        }
      }
    });
    const buttons = elementsOfType(element, "button");
    buttons.forEach((button) => (button.props.onClick as () => void)());
    expect(buttons).toHaveLength(4);
    expect(onToggleMute).toHaveBeenCalledOnce();
    expect(onToggleCamera).toHaveBeenCalledOnce();
    expect(onToggleScreen).toHaveBeenCalledOnce();
    expect(onEndCall).toHaveBeenCalledOnce();
  });

  it("hides lobby media controls until the user joins the voice channel", () => {
    const element = LobbyStage({
      channelName: "Lobby",
      presence: [],
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      connected: true,
      controlsVisible: false,
      onToggleMute: vi.fn(),
      onToggleCamera: vi.fn(),
      onToggleScreen: vi.fn(),
      onEndCall: vi.fn(),
      labels: {
        subtitle: "Talk together",
        participants: (count: number) => `${count} participants`,
        emptyTitle: "No one is here yet",
        emptyDescription: "Join the voice channel",
        speaking: "Speaking",
        muted: "Muted",
        controls: {
          microphone: "Microphone",
          mute: "Mute",
          camera: "Camera",
          cameraOff: "Camera off",
          screenShare: "Share screen",
          stopScreenShare: "Stop sharing",
          endCall: "End call",
          addParticipant: "Add participant",
          mediaSettings: "Audio settings"
        }
      }
    });

    expect(elementsOfType(element, "button")).toHaveLength(0);
  });
});

describe("shared private-call UI", () => {
  it("renders connected-call controls and delegates media actions", () => {
    const onToggleMute = vi.fn();
    const onToggleDeafen = vi.fn();
    const onTogglePushToTalk = vi.fn();
    const onEndCall = vi.fn();
    const element = PrivateCallStage({
      peer: { username: "👩‍🔬Lin" },
      callState: "connected",
      callTime: "00:42",
      muted: true,
      deafened: false,
      pushToTalk: true,
      pttPressed: true,
      labels: {
        incoming: "Incoming call",
        ringing: "Ringing",
        privateConversation: (time) => `Private conversation · ${time}`,
        microphone: "Microphone",
        mute: "Mute",
        unmute: "Unmute",
        deafen: "Deafen",
        undeafen: "Undeafen",
        pushToTalkTitle: "Hold V to talk",
        speaking: "Speaking",
        pressToTalk: "Hold V",
        voiceActivity: "Voice activity",
        close: "Close"
      },
      onToggleMute,
      onToggleDeafen,
      onTogglePushToTalk,
      onEndCall
    });
    const buttons = elementsOfType(element, "button");

    expect(textContent(element)).toContain("Private conversation · 00:42");
    expect(textContent(element)).toContain("👩‍🔬L");
    buttons.forEach((button) => (button.props.onClick as () => void)());
    expect(onToggleMute).toHaveBeenCalledOnce();
    expect(onToggleDeafen).toHaveBeenCalledOnce();
    expect(onTogglePushToTalk).toHaveBeenCalledOnce();
    expect(onEndCall).toHaveBeenCalledOnce();
  });
});

describe("shared direct-message header", () => {
  it("keeps search, block, navigation, and call actions renderer-owned", () => {
    const onBack = vi.fn();
    const onSearchQueryChange = vi.fn();
    const onBlock = vi.fn();
    const onCall = vi.fn();
    const element = DirectMessageHeader({
      peer: { id: "account-2", username: "Lin" },
      statusLabel: "Typing…",
      searchQuery: "hello",
      callState: "calling",
      labels: {
        back: "Back",
        block: "Block user",
        searchPlaceholder: "Search messages",
        calling: "Ringing…",
        call: "Call",
        endCall: "End call"
      },
      onBack,
      onSearchQueryChange,
      onBlock,
      onCall
    });
    const buttons = elementsOfType(element, "button");
    const search = elementsOfType(element, "input")[0];

    expect(textContent(element)).toContain("Typing…");
    expect(textContent(element)).toContain("Ringing…");
    (buttons[0]?.props.onClick as () => void)();
    (buttons[1]?.props.onClick as () => void)();
    (buttons[2]?.props.onClick as () => void)();
    (search?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "world" }
    });
    expect(onBack).toHaveBeenCalledOnce();
    expect(onBlock).toHaveBeenCalledOnce();
    expect(onCall).toHaveBeenCalledOnce();
    expect(onSearchQueryChange).toHaveBeenCalledWith("world");
  });
});

describe("shared server chrome", () => {
  it("delegates topbar actions and preserves the localized status options", () => {
    const onOpenMediaSettings = vi.fn();
    const onOpenFriends = vi.fn();
    const onStatusChange = vi.fn();
    const element = ServerTopbar({
      guildName: "Echo",
      incomingRequestCount: 2,
      status: "online",
      labels: {
        general: "General",
        mediaSettings: "Audio & video",
        friends: "Friends",
        status: "Status",
        online: "Online",
        idle: "Idle",
        dnd: "Do not disturb",
        invisible: "Invisible",
        noiseSuppression: "Noise suppression"
      },
      onOpenMediaSettings,
      onOpenFriends,
      onStatusChange
    });
    const buttons = elementsOfType(element, "button");
    const select = elementsOfType(element, "select")[0];

    expect(textContent(element)).toContain("Echo");
    expect(textContent(element)).toContain("Friends (2)");
    buttons.forEach((button) => (button.props.onClick as () => void)());
    (select?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "dnd" }
    });
    expect(onOpenMediaSettings).toHaveBeenCalledOnce();
    expect(onOpenFriends).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalledWith("dnd");
  });

  it("keeps guild creation input and commands renderer-owned", () => {
    const onNameChange = vi.fn();
    const onCancel = vi.fn();
    const onCreate = vi.fn();
    const element = CreateGuildDialog({
      name: "Echo",
      labels: {
        title: "New guild",
        namePlaceholder: "Guild name",
        cancel: "Cancel",
        create: "Create"
      },
      onNameChange,
      onCancel,
      onCreate
    });
    const input = elementsOfType(element, "input")[0];
    const buttons = elementsOfType(element, "button");

    expect(textContent(element)).toContain("New guild");
    const dialog = Children.toArray(element.props.children)[0] as ReactElement;
    expect(dialog.props["aria-label"]).toBe("New guild");
    expect(input?.props["aria-label"]).toBe("Guild name");
    (input?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "New Echo" }
    });
    (input?.props.onKeyDown as (event: { key: string }) => void)({ key: "Enter" });
    (buttons[0]?.props.onClick as () => void)();
    (buttons[1]?.props.onClick as () => void)();
    expect(onNameChange).toHaveBeenCalledWith("New Echo");
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("composes channel, media, and voice surfaces from renderer-owned callbacks", () => {
    const onVideoLayoutChange = vi.fn();
    const onSendMessage = vi.fn();
    const onToggleScreen = vi.fn();
    const element = ServerView({
      guildName: "Echo",
      incomingRequestCount: 0,
      status: "online",
      videoLayout: "grid",
      videoStatus: "Camera off",
      localVideoRef: { current: null },
      remoteVideoHostRef: { current: null },
      localVideoActive: false,
      localSpeaking: false,
      muted: false,
      cameraOn: false,
      screenOn: false,
      connected: true,
      voiceJoined: true,
      messages: [],
      text: "hello",
      error: "",
      labels: {
        topbar: {
          general: "General",
          mediaSettings: "Audio & video",
          friends: "Friends",
          status: "Status",
          online: "Online",
          idle: "Idle",
          dnd: "Do not disturb",
          invisible: "Invisible",
          noiseSuppression: "Noise suppression"
        },
        video: { videoShare: "Video", grid: "Grid", focus: "Focus" },
        channel: { welcomeTitle: "Welcome", channelBeginning: "Beginning" },
        composer: {
          inputLabel: "Message",
          placeholder: "Write",
          emojiLabel: "Emoji",
          sendLabel: "Send"
        },
        voice: {
          mute: "Mute",
          microphone: "Microphone",
          camera: "Camera",
          cameraOff: "Camera off",
          screenShare: "Share screen",
          stopScreenShare: "Stop sharing",
          endCall: "End call",
          online: "Online",
          offline: "Offline"
        }
      },
      formatDate: () => "date",
      onOpenMediaSettings: vi.fn(),
      onOpenFriends: vi.fn(),
      onStatusChange: vi.fn(),
      onVideoLayoutChange,
      onTextChange: vi.fn(),
      onAddEmoji: vi.fn(),
      onSendMessage,
      onToggleMute: vi.fn(),
      onToggleCamera: vi.fn(),
      onToggleScreen,
      onEndCall: vi.fn(),
      onDismissError: vi.fn()
    });
    const video = elementsOfType(element, VideoStage)[0];
    const composer = elementsOfType(element, ChatComposer)[0];
    const voice = elementsOfType(element, VoiceControls)[0];

    (video?.props.onLayoutChange as (layout: "grid" | "focus") => void)("focus");
    (composer?.props.onSend as () => void)();
    (voice?.props.onToggleScreen as () => void)();
    expect(onVideoLayoutChange).toHaveBeenCalledWith("focus");
    expect(onSendMessage).toHaveBeenCalledOnce();
    expect(onToggleScreen).toHaveBeenCalledOnce();
  });

  it("renders localized guild search controls and forwards search actions", () => {
    const onSearchQueryChange = vi.fn();
    const onSearch = vi.fn();
    const onClearSearch = vi.fn();
    const element = ServerView({
      guildName: "Echo",
      incomingRequestCount: 0,
      status: "online",
      videoLayout: "grid",
      videoStatus: "Camera off",
      localVideoRef: { current: null },
      remoteVideoHostRef: { current: null },
      localVideoActive: false,
      localSpeaking: false,
      muted: false,
      cameraOn: false,
      screenOn: false,
      connected: true,
      messages: [],
      searchQuery: "hello",
      searchResults: [],
      text: "",
      labels: {
        topbar: {
          general: "General",
          mediaSettings: "Audio & video",
          friends: "Friends",
          status: "Status",
          online: "Online",
          idle: "Idle",
          dnd: "Do not disturb",
          invisible: "Invisible",
          noiseSuppression: "Noise suppression"
        },
        video: { videoShare: "Video", grid: "Grid", focus: "Focus" },
        channel: { welcomeTitle: "Welcome", channelBeginning: "Beginning" },
        composer: {
          inputLabel: "Message",
          placeholder: "Write",
          emojiLabel: "Emoji",
          sendLabel: "Send"
        },
        chat: {
          searchPlaceholder: "Search messages",
          search: "Search",
          clearSearch: "Clear",
          pin: "Pin",
          unpin: "Unpin",
          copyLink: "Copy link",
          pinned: "Pinned",
          searchResults: "Search results",
          noSearchResults: "No messages"
        },
        voice: {
          mute: "Mute",
          microphone: "Microphone",
          camera: "Camera",
          cameraOff: "Camera off",
          screenShare: "Share screen",
          stopScreenShare: "Stop sharing",
          endCall: "End call",
          online: "Online",
          offline: "Offline"
        }
      },
      formatDate: () => "date",
      onOpenMediaSettings: vi.fn(),
      onOpenFriends: vi.fn(),
      onStatusChange: vi.fn(),
      onVideoLayoutChange: vi.fn(),
      onTextChange: vi.fn(),
      onSearchQueryChange,
      onSearch,
      onClearSearch,
      onAddEmoji: vi.fn(),
      onSendMessage: vi.fn(),
      onToggleMute: vi.fn(),
      onToggleCamera: vi.fn(),
      onToggleScreen: vi.fn(),
      onEndCall: vi.fn(),
      onDismissError: vi.fn()
    });
    const searchInput = elementsOfType(element, "input").find(
      (input) => input.props.placeholder === "Search messages"
    );
    const buttons = elementsOfType(element, "button");
    const searchButton = buttons.find((button) => buttonText(button) === "Search");
    const clearButton = buttons.find((button) => buttonText(button) === "Clear");

    (searchInput?.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "world" }
    });
    (searchInput?.props.onKeyDown as (event: { key: string }) => void)({ key: "Enter" });
    (clearButton?.props.onClick as () => void)();
    expect(searchButton).toBeDefined();
    expect(onSearchQueryChange).toHaveBeenCalledWith("world");
    expect(onSearch).toHaveBeenCalledOnce();
    expect(onClearSearch).toHaveBeenCalledOnce();
    expect(textContent(element)).toContain("No messages");
    expect(elementsOfType(element, VoiceControls)).toHaveLength(0);
  });

  it("keeps workspace overlays catalog-driven and effect-free", () => {
    const onCloseFriends = vi.fn();
    const onCloseScreenPicker = vi.fn();
    const onCancelCreate = vi.fn();
    const element = WorkspaceOverlays({
      presence: [],
      localSpeaking: false,
      muted: false,
      speakingPeers: {},
      peerMuted: {},
      peerVolumes: {},
      showAudioSettings: true,
      audioInputs: [],
      audioOutputs: [],
      videoInputs: [],
      selectedInput: "",
      selectedOutput: "",
      selectedCamera: "",
      screenQuality: "720",
      screenFps: 30,
      lobbySoundsEnabled: true,
      effectVolume: 70,
      showFriends: true,
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      friendSearchResults: [],
      unreadDm: {},
      friendSearch: "",
      incomingCall: null,
      privateCallPeer: null,
      ringing: false,
      callTime: "00:00",
      showScreenPicker: true,
      screenSources: [],
      screenPermission: "denied",
      showCreate: true,
      showJoin: false,
      newGuildName: "",
      joinCode: "",
      inviteGuildName: "",
      inviteToken: "",
      inviteCopied: false,
      labels: {
        members: {
          onlineCount: (count) => `${count} online`,
          botsCount: "bots",
          self: "self",
          muteOnlyYou: "mute only you",
          muted: "muted",
          volumeFor: (username) => `volume ${username}`,
          botName: "bot",
          botHelp: "help"
        },
        media: {
          title: "Media",
          description: "Description",
          microphoneInput: "Microphone",
          speakerOutput: "Speaker",
          speakerFallback: (id) => id,
          systemDefault: "Default",
          videoSection: "Video",
          cameraInput: "Camera",
          microphoneFallback: (id) => id,
          cameraFallback: (id) => id,
          screenQualityLabel: "Quality",
          quality: (quality) => String(quality),
          fps: "FPS",
          shareProfile: (quality, fps) => `${quality}/${fps}`,
          changeNotice: "Notice",
          lobbySounds: "Sounds",
          lobbySoundsDescription: "Sound settings",
          effectVolume: (volume) => String(volume),
          close: "Close"
        },
        friends: {
          title: "Friends",
          close: "Close",
          searchPlaceholder: "Search",
          search: "Search",
          searchResults: "Results",
          incomingRequests: "Requests",
          outgoingRequests: "Pending",
          myFriends: "My friends",
          noFriends: "No friends",
          add: "Add",
          accept: "Accept",
          decline: "Decline",
          openDirectMessage: "Message",
          call: "Call",
          remove: "Remove"
        },
        calls: {
          incomingPrivateCall: "Incoming",
          answer: "Answer",
          reject: "Reject",
          endCall: "End",
          ringing: "Ringing",
          privateConversation: (time) => time
        },
        screen: {
          title: "Screen",
          chooseSource: "Choose",
          close: "Close",
          permissionOff: "Permission off",
          openSystemSettings: "Settings"
        },
        guild: { title: "Guild", namePlaceholder: "Name", cancel: "Cancel", create: "Create" },
        joinGuild: {
          title: "Join guild",
          codePlaceholder: "Invite code",
          cancel: "Cancel",
          join: "Join"
        },
        invite: {
          title: "Invite {{guild}}",
          description: "Description",
          copy: "Copy",
          copied: "Copied",
          close: "Close"
        }
      },
      onTogglePeerMute: vi.fn(),
      onPeerVolumeChange: vi.fn(),
      onInputChange: vi.fn(),
      onOutputChange: vi.fn(),
      onCameraChange: vi.fn(),
      onScreenQualityChange: vi.fn(),
      onScreenFpsChange: vi.fn(),
      onLobbySoundsChange: vi.fn(),
      onEffectVolumeChange: vi.fn(),
      onCloseAudioSettings: vi.fn(),
      onCloseFriends,
      onFriendSearchChange: vi.fn(),
      onSearchFriends: vi.fn(),
      onSendFriendRequest: vi.fn(),
      onRespondFriendRequest: vi.fn(),
      onCancelFriendRequest: vi.fn(),
      onOpenDm: vi.fn(),
      onCallFriend: vi.fn(),
      onRemoveFriend: vi.fn(),
      onAnswerCall: vi.fn(),
      onEndCall: vi.fn(),
      onCloseScreenPicker,
      onOpenSystemSettings: vi.fn(),
      onSelectScreenSource: vi.fn(),
      onGuildNameChange: vi.fn(),
      onCancelCreate,
      onCreateGuild: vi.fn(),
      onJoinCodeChange: vi.fn(),
      onCancelJoin: vi.fn(),
      onJoinGuild: vi.fn(),
      onCopyInvite: vi.fn(),
      onCloseInvite: vi.fn()
    });
    const friends = elementsOfType(element, FriendsModal)[0];
    const screenPicker = elementsOfType(element, ScreenPicker)[0];
    const createGuild = elementsOfType(element, CreateGuildDialog)[0];

    expect(elementsOfType(element, MembersPanel)).toHaveLength(1);
    expect(elementsOfType(element, MediaSettingsModal)).toHaveLength(1);
    expect(elementsOfType(element, CallAlerts)).toHaveLength(1);
    expect(friends).toBeDefined();
    expect(screenPicker).toBeDefined();
    expect(createGuild).toBeDefined();
    (friends?.props.onClose as () => void)();
    (screenPicker?.props.onClose as () => void)();
    (createGuild?.props.onCancel as () => void)();
    expect(onCloseFriends).toHaveBeenCalledOnce();
    expect(onCloseScreenPicker).toHaveBeenCalledOnce();
    expect(onCancelCreate).toHaveBeenCalledOnce();
  });
});
