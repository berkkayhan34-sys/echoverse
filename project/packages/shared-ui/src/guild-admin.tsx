/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type GuildAdminMember = {
  accountId: string;
  username: string;
  role: "owner" | "admin" | "moderator" | "member";
  avatarData?: string | null;
};

export type GuildAdminPanelLabels = {
  title: string;
  members: string;
  role: string;
  saveRole: string;
  report: string;
  reportReason: string;
};

/** Shared, renderer-neutral role administration surface. Server authorization remains authoritative. */
export function GuildAdminPanel({
  members,
  labels,
  canManage,
  onRoleChange,
  onReport
}: {
  members: GuildAdminMember[];
  labels: GuildAdminPanelLabels;
  canManage: boolean;
  onRoleChange: (accountId: string, role: Exclude<GuildAdminMember["role"], "owner">) => void;
  onReport: (accountId: string, reason: string) => void;
}) {
  return (
    <section className="guild-admin-panel" aria-label={labels.title}>
      <h2>{labels.title}</h2>
      <div className="guild-admin-members-title">{labels.members}</div>
      {members.map((member) => (
        <div className="guild-admin-member" key={member.accountId}>
          <span>{member.username}</span>
          {canManage && member.role !== "owner" ? (
            <label>
              <span className="sr-only">{labels.role}</span>
              <select
                value={member.role}
                onChange={(event) =>
                  onRoleChange(
                    member.accountId,
                    event.target.value as Exclude<GuildAdminMember["role"], "owner">
                  )
                }
              >
                <option value="member">member</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
            </label>
          ) : (
            <span>{member.role}</span>
          )}
          <button type="button" onClick={() => onReport(member.accountId, "")}>
            {labels.report}
          </button>
        </div>
      ))}
      <span className="sr-only">{labels.reportReason}</span>
    </section>
  );
}
