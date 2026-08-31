<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Temporary MacBook server runbook

This runbook provisions the temporary Debian/T2 host observed as
`echoverse-server`. It deliberately keeps SSH/SFTP in AnySCP; the repository
never stores or receives the AnySCP password.

## Target profile

- runner checkout path: `/home/berkkayhan/actions-runner/_work/echoverse/echoverse`;
- host configuration path: `/home/berkkayhan/.config/echoverse`;
- runner path: `/home/berkkayhan/actions-runner`;
- service user: `berkkayhan` (non-root);
- server port: `3001`;
- persistence: PostgreSQL through `DATABASE_URL`;
- public ingress: Cloudflare Tunnel to `http://localhost:3001`;
  the same service serves the built web renderer at `/` and the API/Socket.IO
  endpoints from the same origin.

## One-time host preparation

Run the following reviewed steps in the already-open AnySCP SSH terminal. The
GitHub runner registration token must be generated for this repository from
GitHub Settings → Actions → Runners and pasted only when prompted; it expires
and must not be saved in shell history or a file.

```sh
set -eu
test "$(id -un)" = "berkkayhan"
test "$(uname -s)" = "Linux"
test "$(node -p 'process.versions.node.split(".")[0]')" = "22"
command -v npm >/dev/null
command -v make >/dev/null
command -v g++ >/dev/null
command -v python3 >/dev/null
command -v systemctl >/dev/null
mkdir -p "$HOME/.config/echoverse" "$HOME/actions-runner"
```

The workspace includes native Node.js modules such as `better-sqlite3`. On a
minimal Debian installation, install the compiler toolchain before the first
deployment, then rerun the checks above:

```sh
sudo apt-get update
sudo apt-get install -y build-essential
```

Install and register the runner using the exact current commands displayed by
GitHub for this repository, selecting labels `self-hosted`, `linux`, `x64`, and
`echoverse-server`, and installing it as the `berkkayhan` user. Do not run the
runner as root and do not enable the runner for other repositories.

Create `$HOME/.config/echoverse/server.env` with mode `600` and these keys,
using the owner-managed values (never commit this file):

```dotenv
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
# The MacBook's local PostgreSQL normally does not need TLS.
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=...
ECHO_VERSE_MAIN_OWNER_EMAIL=...
CORS_ORIGINS=https://echoverse.borayarkin.net,https://berkkayhan34-sys.github.io
TRUST_PROXY=true
WEB_COOKIE_SECURE=true
WEB_COOKIE_SAMESITE=none
```

Install the unit from `deploy/systemd/echoverse.service` into
`$HOME/.config/systemd/user/echoverse.service`, then run:

```sh
systemctl --user daemon-reload
systemctl --user enable echoverse.service
systemctl --user start echoverse.service
curl --fail http://127.0.0.1:3001/health
```

For restart after logout/reboot, enable user lingering once with the host
administrator: `sudo loginctl enable-linger berkkayhan`.

## Cloudflare mapping

After `/health` succeeds locally, create the dashboard tunnel/public hostname
`echoverse.borayarkin.net` with service `http://localhost:3001`. Opening the
hostname must show the EchoVerse web sign-in screen; `/health` remains the
machine-readable readiness endpoint. Do not expose the MacBook port directly
or disable the server's CORS, cookie, or proxy settings.

## Ongoing deployment

`.github/workflows/deploy-self-hosted.yml` runs on pushes to `main` that touch
the server or shared packages. It checks Node.js 22, installs the canonical
workspace, runs typecheck/tests/build, verifies the local environment file,
restarts the user service, and requires a successful `/health` response. A
failed health check is a failed deployment; inspect the runner's user journal
before retrying.
