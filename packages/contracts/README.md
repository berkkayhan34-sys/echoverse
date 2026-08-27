<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Contracts

Versioned protocol v2 DTOs, envelopes, and runtime boundary schemas shared by
the server, web client, and desktop client.

The package owns strict protocol envelopes and compatibility fixtures for
version negotiation, pagination, attachments, safe error responses, and
WebRTC signaling. Consumers should parse untrusted payloads at their transport
boundary before handing data to feature logic.

## Localization

`src/i18n.ts` is the shared catalog boundary for application-owned text. Web
and desktop resolve `en` or `tr` from the user-selected locale, use English as
the deterministic fallback, and persist only the locale choice locally. Add a
key to both catalogs in the same change; `i18n.test.ts` verifies key and
placeholder parity, Unicode fixtures, fallback behavior, and locale-aware
formatting. Protocol/event names, SQL/CSS identifiers, URLs, and third-party
literal names stay outside the catalog.
