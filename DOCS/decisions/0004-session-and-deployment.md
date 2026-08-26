<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0004: session safety and deployment manifest authority

- Status: Accepted
- Date: 2026-08-26

## Decision

Use a **hybrid session model**:

- Web uses short-lived, `Secure`, `HttpOnly`, `SameSite`-appropriate cookies;
- desktop uses short-lived access tokens and refresh tokens stored only through
  the operating system's secure storage boundary;
- refresh rotation, revocation, expiry, origin checks, and logout semantics are
  server-enforced and covered by negative tests.

The authoritative Render deployment manifest is `apps/server/render.yaml`. The root
`render.yaml` is legacy metadata until it is explicitly retired in a later
cleanup decision; deployment automation must not silently maintain two
independent sources.

## Rationale and consequences

This model limits browser token exposure while respecting Electron's native
secure-storage boundary. It introduces lifecycle and revocation complexity that
must be implemented and tested before the 2.0.0 cutover. A single deployment
manifest prevents environment and secret configuration drift.
