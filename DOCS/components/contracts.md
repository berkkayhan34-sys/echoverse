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

`src/localizations/en.json` and `src/localizations/tr.json` are the locale
catalogs for application-owned text. `src/localization.ts` is the code-facing
boundary: web and desktop resolve `en` or `tr` from the user-selected locale,
use English as the deterministic fallback, and persist only the locale choice
locally. Add a key to both JSON catalogs in the same change;
`localization.test.ts` verifies key and placeholder parity, Unicode fixtures,
fallback behavior, and locale-aware formatting. Protocol/event names, SQL/CSS
identifiers, URLs, and third-party literal names stay outside the catalog.
