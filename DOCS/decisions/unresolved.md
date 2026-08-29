<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Decision status

## Resolved decisions

### CODE-006 runtime feature-module ownership

Resolved on 2026-08-28: option **a**, per-renderer feature modules with shared
pure `client-core` helpers. The accepted architecture is recorded in
[ADR-0012](0012-renderer-feature-module-ownership.md). The remaining work is
implementation and evidence, not an unresolved architecture decision.

### CODE-008 release smoke environment

The release validation implementation now verifies updater metadata, SHA-512
checksums, blockmaps, and packaged startup through the explicit smoke-test
entrypoint. Apple Silicon artifacts pass locally. The required platform launch
checks were completed on the configured GitHub Actions environments: Windows,
macOS Intel, and macOS Apple Silicon.

The final successful workflow evidence is recorded in
[`../evidence/CODE-008.md`](../evidence/CODE-008.md). Local Intel execution
remains unavailable on this Apple Silicon host, but it no longer blocks the
roadmap because the required CI runner evidence exists.

Operational ownership, incident escalation, evidence retention, and release
approval are defined in the [governance and public-release runbook](../governance.md).
The current owner identity comes from CODEOWNERS; any later delegation must be
recorded with scope, dates, and handoff evidence.

No unresolved owner decision blocks the current audit-closure documentation
pass. The deferred release-signing decision below remains intentionally outside
the current baseline and does not authorize public release.

### ARCH-001 Discord + TeamSpeak product direction — resolved

Resolved on 2026-08-28 using [ADR-0014](0014-discord-teamspeak-product-direction.md):
Discord-style space hierarchy, granular permissions, provider-neutral SFU
boundary, account/friend/DM identity, PWA-first mobile delivery,
owner/admin-first moderation, Unicode/custom emoji before rich media, and
public single-region scale with private invitation-only servers.

The owner confirmed the detailed execution profile on 2026-08-29 in
[ADR-0021](0021-discord-parity-execution-profile.md): bounded P2P voice as the
current implementation path, full Discord-style channel/social/messaging and
notification behavior, and automatic public-main/private-member-only server
visibility. Implementation and evidence remain on the active roadmap.

### OPS-003 platform signing and notarization

OPS-003 is blocked as of 2026-08-28. The release workflows intentionally
produce unsigned validation artifacts, and the repository has no configured
Windows publisher certificate/provider or Apple Developer signing and
notarization credentials. The owner must select a signing arrangement and
provision protected CI credentials before implementation can continue. The
exact evidence and remaining work are recorded in
[`../evidence/OPS-003.md`](../evidence/OPS-003.md).
