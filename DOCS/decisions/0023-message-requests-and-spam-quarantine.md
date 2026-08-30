<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0023: message requests and spam quarantine

Status: accepted
Date: 2026-08-31
Owners: EchoVerse maintainers

## Context

Direct messages currently have a friendship boundary, but a user needs a
safe way to contact someone who is not yet a friend. The first contact must
not silently become a normal conversation or deliver attachments before the
recipient has made a decision.

## Decision

- A non-friend may create one directional, text-only message request.
- The request is stored as `pending` and is visible only to its sender and
  recipient. A unique `(sender_id, recipient_id)` constraint makes retries
  deterministic; another pending request is not created.
- The recipient may accept, decline, or mark the request as spam. Accepting
  creates the accepted friendship and converts the original text into the
  first normal DM. Declining and spam keep the request closed; later sends
  are rejected until a future product decision adds a re-open flow.
- Attachments are rejected until the friendship is accepted. Group DMs keep
  their existing membership rules and are not routed through this workflow.
- Every decision is enforced in the server handler and service layer. The
  client only renders the request state and cannot grant access. A block made
  after a request prevents acceptance and takes precedence over the request.

## Reliability and recovery

The request row and its optional converted message ID are persisted in one
additive migration. Acceptance uses a stable message ID and a conditional
`COALESCE` update so concurrent accepts converge on one message. If a deploy
must be rolled back, the migration is left in place and the prior binary
ignores the new table; removing request data is a forward-recovery operation,
not an automatic rollback.

## Security consequences

Authorization is checked against the authenticated recipient for every
response action. Request bodies are sanitized at the socket boundary, are not
written to server logs, and are delivered only to the intended recipient and
sender. Blocked users cannot create or accept requests, and oversized or
malformed attachments remain rejected by the existing attachment validator.

## Verification

The acceptance and rejection paths are covered by integration tests for
pending deduplication, accept-to-friend conversion, spam closure, blocked
acceptance, and attachment rejection. Authenticated two-account browser
evidence is recorded in [`evidence/CHAT-001.md`](../evidence/CHAT-001.md).
