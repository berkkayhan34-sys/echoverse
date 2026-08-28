<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Operations and production diagnostics

EchoVerse emits a small, privacy-safe operational signal from the server
without sending telemetry to a third party. Records are one-line JSON objects
with an ISO timestamp, stable event ID, severity, service name, and only the
bounded fields needed to diagnose transport and lifecycle behavior.

## Diagnostics contract

- HTTP responses receive an `X-EchoVerse-Request-ID` correlation identifier.
  A caller-provided value is accepted only when it is short and restricted to
  safe identifier characters; malformed values are replaced with an opaque
  random identifier.
- Socket connections use the same correlation rule and retain only the
  correlation identifier in socket state.
- Request completion, socket lifecycle, rejected payloads, and rate-limit
  events are represented by stable machine-readable event IDs.
- Counters and request timing summaries are process-local, bounded to known
  metric names, and contain no request payload, URL query, account, socket, or
  message data. A non-sensitive snapshot is available from `/health`. They
  reset on process restart; durable telemetry is not part of this initial
  observability decision.
- Errors are logged as event IDs and safe operational fields. Passwords,
  access/refresh tokens, cookies, authorization headers, OAuth codes, message
  bodies, attachments, media, and user/account/session/socket identifiers are
  redacted or omitted before serialization.

## Retention and access controls

The server writes diagnostics to standard output only. The hosting platform or
process supervisor is the log system of record and MUST be configured before a
public release with:

1. access limited to the operational owner and explicitly delegated incident
   responders;
2. encrypted storage and transport provided by the host;
3. a documented expiry and deletion owner, using the minimum retention needed
   for reliability and security investigation;
4. redacted export only when an incident requires sharing evidence; and
5. deletion verification recorded as release or incident metadata without
   retaining deleted payloads.

Local development output is disposable and belongs under the ignored `tmp/`
directory when a command writes files. The application does not create a
server-side diagnostic file or an unbounded application log. Restricted host
logs and provider exports MUST NOT be committed to Git, copied into fixtures,
or attached to roadmap evidence.

## Incident diagnostic procedure

1. Record the affected version, commit, approximate time window, event IDs, and
   correlation IDs only.
2. Query the host log system using those values; do not search by password,
   token, cookie, message body, media, or personal identifier.
3. Preserve the minimum redacted result under the approved access-controlled
   incident system, not in this repository.
4. Follow the containment, escalation, recovery, and evidence requirements in
   [governance.md](governance.md).

The operational owner is the repository owner until a dated delegation is
recorded in the release or incident evidence. Platform retention settings and
public-release activation remain owner-operated controls; the application
cannot claim those external settings are active merely because it emits safe
records.
