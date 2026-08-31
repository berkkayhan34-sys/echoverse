/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  GuildCategory,
  GuildChannel,
  GuildChannelType,
  GuildMember
} from "@echoverse/contracts";
import { useMemo, useState, type FormEvent } from "react";

export type GuildStructureLabels = {
  title: string;
  close: string;
  categories: string;
  channels: string;
  members: string;
  categoryNamePlaceholder: string;
  channelNamePlaceholder: string;
  createCategory: string;
  createChannel: string;
  rename: string;
  archive: string;
  type: string;
  channelTypeText: Record<GuildChannelType, string>;
  role: string;
  roleText: Record<GuildMember["role"], string>;
  noChannels: string;
};

const channelTypes: GuildChannelType[] = ["text", "voice", "stage", "forum"];

export function GuildStructurePanel({
  channels,
  categories,
  members,
  labels,
  canManage,
  onClose,
  onCreateCategory,
  onUpdateCategory,
  onCreateChannel,
  onUpdateChannel,
  onRoleChange
}: {
  channels: GuildChannel[];
  categories: GuildCategory[];
  members: GuildMember[];
  labels: GuildStructureLabels;
  canManage: boolean;
  onClose: () => void;
  onCreateCategory: (name: string) => void;
  onUpdateCategory: (categoryId: string, updates: { name?: string; archived?: boolean }) => void;
  onCreateChannel: (name: string, type: GuildChannelType, categoryId?: string | null) => void;
  onUpdateChannel: (channelId: string, updates: { name?: string; archived?: boolean }) => void;
  onRoleChange: (accountId: string, role: Exclude<GuildMember["role"], "owner">) => void;
}) {
  const [categoryName, setCategoryName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<GuildChannelType>("text");
  const [channelCategoryId, setChannelCategoryId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"channels" | "categories" | "members">("channels");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const groupedMembers = useMemo(() => {
    const groups = new Map<GuildMember["role"], GuildMember[]>();
    for (const member of members)
      groups.set(member.role, [...(groups.get(member.role) || []), member]);
    return (["owner", "admin", "moderator", "member"] as const).flatMap((role) =>
      groups.has(role) ? [{ role, members: groups.get(role)! }] : []
    );
  }, [members]);

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name || !canManage) return;
    onCreateCategory(name);
    setCategoryName("");
  };

  const submitChannel = (event: FormEvent) => {
    event.preventDefault();
    const name = channelName.trim();
    if (!name || !canManage) return;
    onCreateChannel(name, channelType, channelCategoryId || null);
    setChannelName("");
  };

  const startEdit = (id: string, name: string) => {
    setEditing(id);
    setDraft(name);
  };

  const saveEdit = (kind: "category" | "channel", id: string) => {
    const name = draft.trim();
    if (name) {
      if (kind === "category") onUpdateCategory(id, { name });
      else onUpdateChannel(id, { name });
    }
    setEditing(null);
    setDraft("");
  };

  const visibleCategories = categories.filter((category) => !category.archived);
  const visibleChannels = channels.filter((channel) => !channel.archived);
  const uncategorized = visibleChannels.filter((channel) => !channel.categoryId);

  return (
    <div
      className="guild-structure-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="guild-structure-panel"
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
      >
        <header className="guild-structure-header">
          <h2>{labels.title}</h2>
          <button type="button" className="icon-btn" aria-label={labels.close} onClick={onClose}>
            ×
          </button>
        </header>

        <div className="guild-structure-tabs" role="tablist" aria-label={labels.title}>
          {(["channels", "categories", "members"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {labels[tab]}
            </button>
          ))}
        </div>

        {canManage && activeTab === "categories" && (
          <div className="guild-structure-forms">
            <form onSubmit={submitCategory}>
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder={labels.categoryNamePlaceholder}
                maxLength={64}
              />
              <button type="submit" disabled={!categoryName.trim()}>
                {labels.createCategory}
              </button>
            </form>
          </div>
        )}

        {canManage && activeTab === "channels" && (
          <div className="guild-structure-forms">
            <form onSubmit={submitChannel}>
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                placeholder={labels.channelNamePlaceholder}
                maxLength={64}
              />
              <select
                aria-label={labels.type}
                value={channelType}
                onChange={(event) => setChannelType(event.target.value as GuildChannelType)}
              >
                {channelTypes.map((type) => (
                  <option key={type} value={type}>
                    {labels.channelTypeText[type]}
                  </option>
                ))}
              </select>
              <select
                aria-label={labels.categories}
                value={channelCategoryId}
                onChange={(event) => setChannelCategoryId(event.target.value)}
              >
                <option value="">{labels.categories}</option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!channelName.trim()}>
                {labels.createChannel}
              </button>
            </form>
          </div>
        )}

        <div className="guild-structure-content">
          {activeTab === "channels" && (
            <section
              className="guild-structure-tab-panel"
              aria-labelledby="guild-structure-channels"
            >
              <h3 id="guild-structure-channels">{labels.channels}</h3>
              {[
                ...visibleCategories.map((category) => ({
                  category,
                  channels: visibleChannels.filter((channel) => channel.categoryId === category.id)
                })),
                { category: null, channels: uncategorized }
              ].map(({ category, channels: categoryChannels }) => {
                const key = category?.id || "uncategorized";
                const isCollapsed = collapsed.has(key);
                return (
                  <div className="guild-structure-category" key={key}>
                    <div className="guild-structure-category-row">
                      <button
                        type="button"
                        className="category-collapse"
                        aria-expanded={!isCollapsed}
                        onClick={() =>
                          setCollapsed((current) => {
                            const next = new Set(current);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                      >
                        {isCollapsed ? "▸" : "▾"} {category?.name || labels.categories}
                      </button>
                    </div>
                    {!isCollapsed &&
                      (categoryChannels.length ? (
                        categoryChannels.map((channel) => (
                          <div className="guild-structure-channel-row" key={channel.id}>
                            <span className="channel-type-badge">
                              {labels.channelTypeText[channel.type]}
                            </span>
                            {editing === channel.id ? (
                              <input
                                autoFocus
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") saveEdit("channel", channel.id);
                                  if (event.key === "Escape") setEditing(null);
                                }}
                              />
                            ) : (
                              <span>{channel.name}</span>
                            )}
                            {canManage && (
                              <>
                                {editing === channel.id ? (
                                  <button
                                    type="button"
                                    onClick={() => saveEdit("channel", channel.id)}
                                  >
                                    {labels.rename}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(channel.id, channel.name)}
                                  >
                                    {labels.rename}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onUpdateChannel(channel.id, { archived: true })}
                                >
                                  {labels.archive}
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="guild-structure-empty">{labels.noChannels}</p>
                      ))}
                  </div>
                );
              })}
            </section>
          )}

          {activeTab === "categories" && (
            <section
              className="guild-structure-tab-panel"
              aria-labelledby="guild-structure-categories"
            >
              <h3 id="guild-structure-categories">{labels.categories}</h3>
              {visibleCategories.map((category) => (
                <div className="guild-structure-category-row" key={category.id}>
                  {editing === category.id ? (
                    <div className="guild-structure-inline-edit">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveEdit("category", category.id);
                          if (event.key === "Escape") setEditing(null);
                        }}
                      />
                      <button type="button" onClick={() => saveEdit("category", category.id)}>
                        {labels.rename}
                      </button>
                    </div>
                  ) : (
                    <span>{category.name}</span>
                  )}
                  {canManage && (
                    <>
                      <button type="button" onClick={() => startEdit(category.id, category.name)}>
                        {labels.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateCategory(category.id, { archived: true })}
                      >
                        {labels.archive}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </section>
          )}

          {activeTab === "members" && (
            <section
              className="guild-structure-tab-panel"
              aria-labelledby="guild-structure-members"
            >
              <h3 id="guild-structure-members">{labels.members}</h3>
              <div className="guild-structure-members">
                {groupedMembers.map(({ role, members: roleMembers }) => (
                  <div key={role} className="guild-structure-member-group">
                    <strong>{labels.roleText[role]}</strong>
                    {roleMembers.map((member) => (
                      <div className="guild-structure-member-row" key={member.accountId}>
                        <span title={member.username}>{member.username}</span>
                        {canManage && member.role !== "owner" ? (
                          <select
                            aria-label={`${labels.role}: ${member.username}`}
                            value={member.role}
                            onChange={(event) =>
                              onRoleChange(
                                member.accountId,
                                event.target.value as Exclude<GuildMember["role"], "owner">
                              )
                            }
                          >
                            <option value="member">member</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span>{labels.roleText[member.role]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
