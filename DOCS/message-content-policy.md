<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Message content policy

This document is the canonical contract for channel and direct-message
content. It applies to web, desktop, and responsive mobile clients.

## Bodies and rich content

- Message bodies are Unicode text and are limited by the shared contract to
  2,500 characters.
- Markdown is not interpreted as HTML or executable content. Clients preserve
  line breaks and display the body as text; raw HTML, scripts, SVG, and
  embedded documents are not rendered.
- URLs remain text. The server does not fetch remote URLs or create unfetched
  embeds, which prevents message content from becoming an SSRF surface.
- Deleted messages expose neither their body nor attachment data.

## Attachments

Attachments are validated at the server boundary. The current allowlist is
PNG, JPEG, WebP, GIF, plain text, CSV, JSON, PDF, and ZIP. The declared MIME
type and data URL header must agree, and the shared attachment size limit
applies before persistence. HTML, SVG, executable files, and unknown MIME
types are rejected. ZIP files are stored as opaque downloads; the server does
not extract or execute them.

## Search, replies, and links

- Channel and DM search is scoped to an authorized channel, direct pair, or
  active group conversation. Results are bounded to 100 items per page and
  use an ISO timestamp cursor (`before`) for the next page.
- Optional author and ISO date bounds are applied server-side. A caller cannot
  use them to inspect another conversation.
- A reply may reference only a message in the same channel or conversation.
  Invalid or cross-conversation parent IDs are rejected.
- Mention notifications are emitted only to members who can view the source
  channel or active group conversation. A mention never grants access.
- Message links contain only opaque guild/channel/message identifiers in the
  URL fragment. Opening a link selects the authorized guild and channel before
  restoring the original message location.

Clients must treat server responses as untrusted data and must not bypass
these server-side checks with client-only filtering.
