<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0020: remove Spotify Together

## Status

Accepted for the 1.8.5 release.

## Decision

Spotify Together is removed from the supported product surface. The removal
covers the server event contract and handlers, shared renderer panel and
localization keys, web bridge, Electron IPC bridge, desktop configuration,
tests, and active documentation. On startup, the desktop shell deletes only
the former `spotify-token.bin` file in its own user-data directory so an old
credential is not retained after upgrade.

## Rationale and boundaries

The feature was not part of the target Discord/TeamSpeak product contract and
introduced an external credential and provider boundary that the project does
not currently operate. Removing it avoids an orphaned integration and keeps
the supported protocol and UI surfaces explicit. Historical release records
remain immutable and may mention the former feature.

The removal does not delete user messages, guild data, or unrelated files, and
does not alter authentication or authorization behavior.

## Validation

- Active source, configuration, and documentation contain no Spotify feature
  references; historical records are intentionally preserved.
- Contract, shared-ui, bridge, server, and full test suites pass.
- Desktop and web production builds pass before release publication.
