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
