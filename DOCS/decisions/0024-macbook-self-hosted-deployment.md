<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0024: temporary MacBook self-hosted server

- Status: Accepted
- Date: 2026-08-31

## Decision

Use a GitHub self-hosted runner on the temporary Intel MacBook Linux host for
pull-free, push-triggered EchoVerse server deployments. The runner and the
EchoVerse systemd service run as the non-root `berkkayhan` user. The service
listens on `0.0.0.0:3001`; Cloudflare Tunnel remains the only intended public
ingress and maps the hostname to `http://localhost:3001`.

The hosted runtime uses PostgreSQL through `DATABASE_URL`. Secrets and the
founder email remain in the user-owned
`~/.config/echoverse/server.env` file on the MacBook and are never committed
to the repository or emitted in workflow logs.

## Rationale and consequences

The runner avoids opening an inbound SSH deployment port and gives the owner a
single GitHub push-to-deploy path. It also grants workflow code execution on
the MacBook; therefore the runner is dedicated to this repository, runs as a
non-root user, and deploys only after the server typecheck, tests, build, and
local health check pass. This is temporary infrastructure, not a public-release
hardening decision; the host still needs sleep prevention, PostgreSQL backups,
and a documented recovery drill before it can be treated as production.

## Recovery

The previous service process remains available until the replacement passes
the local health check. If a deployment fails, the workflow leaves the prior
process running when restart is not reached; after a failed restart, use the
previous Git revision and `systemctl --user restart echoverse.service` as the
forward-recovery path. PostgreSQL backups remain operator-controlled.
