<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0015: unattended desktop updates

- Status: Accepted
- Date: 2026-08-29
- Roadmap: `PLATFORM-001`, `SEC-001`

## Decision

Packaged Electron clients check GitHub Releases before creating the tray,
splash screen, or main window. When a newer release is available, the client
downloads it automatically and invokes `electron-updater` with the silent
install flags. The client never opens an installer wizard as part of this
flow. Windows may still display its own UAC consent for an existing
machine-wide installation; bypassing that security control is not supported.

The updater keeps the existing install directory and forwards the package's
`isAdminRightsRequired` metadata. This preserves the installation scope chosen
by the user (per-user or per-machine) without hard-coding a new scope into the
update path. `autoInstallOnAppQuit` remains disabled so an ordinary app exit
cannot unexpectedly open a non-silent installer; completed downloads use the
explicit silent path instead.

If the startup check or download exceeds the bounded timeout, the known-good
version is allowed to open and the failure remains visible in updater state.
The same silent install path is used if a download completes after the window
has opened. Metadata validation, timeout handling, and install triggering are
covered by updater tests and release smoke evidence.

## Consequences

- Users receive updates without interacting with an installer window.
- A slow or unavailable update service cannot permanently prevent the app from
  opening.
- Publisher trust, signing, checksum, and rollback controls remain release
  requirements; unattended installation does not waive them.
