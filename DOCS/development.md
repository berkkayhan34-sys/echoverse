<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Development workflow

This is the local workflow for the v2 modular-monolith workspace.

## Prerequisites

Use Node.js 22 LTS and the repository-supported package manager. Install
dependencies through the root npm workspace. App-specific commands remain
available in `project/apps/server/`, `project/apps/web/`, and `project/apps/desktop/`. Run `npm ci` at
the repository root; the root workspace lockfile is canonical. Do not
commit generated `node_modules`, `tmp/`, logs, or local databases.

GNU Make 4.4.1 is used for the repository targets. On Windows, install it with
the WinGet package `ezwinports.make` and restart the terminal so the updated
PATH is loaded.

## Current workspaces

- `project/apps/server/` — backend development and start scripts;
- `project/apps/web/` — browser client development/build;
- `project/apps/desktop/` — Electron development/build/package scripts;
- `project/packages/contracts/` — protocol v2 DTOs and boundary schemas;
- `project/packages/client-core/` — browser-safe session helpers;
- `project/packages/shared-ui/` — browser-safe shared UI primitives;
- `project/packages/config/` — validated server configuration;

## Local configuration

Desktop runtime settings are read from `project/apps/desktop/config.json`. Keep a local
server URL and placeholder integration identifiers there; do not put secrets in
that file or in examples. `project/apps/server/render.yaml` is the authoritative Render
manifest; `project/render.yaml` is a compatibility/discovery mirror used by
Render installations that only inspect the project-level manifest. Keep service
identity, commands, and non-secret browser deployment settings synchronized in
both files; keep secrets (including generated credentials) authoritative in
`project/apps/server/render.yaml` and never copy them into the mirror. Do not
maintain two independent deployment definitions. Changes to either manifest
must run `make roadmap-check`. Retiring the root mirror or changing this policy
requires an ADR with a rollback path.

For a local server, use `http://localhost:3001` (or the port configured by the
server) and start the server before starting web/desktop. For hosted use, use
the HTTPS endpoint supplied by the approved deployment and verify CORS, TLS,
secret configuration, health, and logs before sharing an installer. Local web
cookies are intentionally non-secure for the HTTP development origin; hosted
deployments must set `WEB_COOKIE_SECURE=true` and use
`WEB_COOKIE_SAMESITE=none` when the approved web origin is cross-site. Set
`TRUST_PROXY=true` only when the service is behind a trusted TLS-terminating
proxy.

## Desktop UI cache

The packaged desktop shell reads `uiUpdate.manifestUrl` from
`project/apps/desktop/config.json`. The URL must be an HTTPS GitHub Pages
manifest. The web build creates the manifest with `npm run ui:manifest`; CI
supplies the protected `ECHO_VERSE_UI_SIGNING_KEY` secret and publishes the
manifest beside the hashed static assets. Do not disable signature validation,
point a packaged build at an arbitrary host, or commit the private signing
key. The shell keeps the bundled renderer as its final recovery path.

The manifest uses schema version 2. Its `version` and `minShellVersion` fields
remain desktop-shell compatibility values, while `webRevision` is the full
lowercase Git commit SHA of the deployed web build. CI supplies `GITHUB_SHA`;
local manifest generation must set `ECHO_VERSE_WEB_REVISION` to a lowercase
commit SHA explicitly. The web bundle's diagnostic version is set by
`ECHO_VERSE_WEB_VERSION` and defaults to `web-local` for local development.
Web-only commits update the signed cache without producing a desktop installer.
Changes to the native shell, desktop configuration, packaging, or
desktop-relevant shared packages still require a new desktop release.

Persistence is selected explicitly: set `SQLITE_PATH=./tmp/runtime/echoverse.sqlite`
for a local file-backed database, or set `DATABASE_URL` for PostgreSQL. Do not
set both. SQLite and PostgreSQL use the same migration IDs and table/column
contract; `npm test` covers SQLite migration, cascade, Unicode, backup, and
restore behavior through the approved native `better-sqlite3` adapter, while
`npm run test:db` covers the PostgreSQL service. The local runtime requires
Node.js 22 LTS, as required by the approved `better-sqlite3` version.

The public EchoVerse guild is reconciled at startup. Set
`ECHO_VERSE_MAIN_OWNER_EMAIL` in the server environment to the founder
account's normalized email before a hosted deployment. The value is an
environment-only administration setting and must not be committed to source,
logs, manifests, or examples. When it is unset, the server fails closed and
does not grant an elevated role to an arbitrary account.

## Localization workflow

Application-owned text is cataloged in
`project/packages/contracts/src/localizations/en.json` and
`project/packages/contracts/src/localizations/tr.json`, and consumed through the shared
translator in both renderers. Add English and Turkish values together, preserve
interpolation placeholders exactly, and use `resolveLocale` rather than
comparing language strings directly. Keep protocol names, SQL/CSS identifiers,
URLs, and third-party literals out of the catalog. Run `npm test`,
`npm run typecheck`, and `npm run build` after catalog changes; the contract
tests cover key parity, fallback, Unicode, and locale-aware date/number
formatting.

### Localization inventory classification

Application-owned natural-language text belongs in both JSON catalogs. The
following repository strings are intentionally non-localizable identifiers:

- protocol and Socket.IO event names, SQL statements, CSS class names, URLs,
  MIME types, storage keys, and machine-readable status values;
- stable structured log event IDs such as `echoverse.auth.login_failed`, which
  keep diagnostics searchable and language-independent;
- product and third-party literals such as `EchoVerse`, `Spotify`, `Spotify
Together`, `LIVE`, and protocol version values.

User-visible errors and notifications are not covered by these exclusions and
must use the shared translator or the server response catalog.

Native permission prompts are package metadata, but their prose is still
catalog-owned: the Electron packaging configuration reads the English catalog
for the locale-neutral macOS permission strings while the renderer remains
locale-aware at runtime. Do not add permission prose directly to
`package.json` or the packaging configuration.

## Hosted backend and installer

The current Render setup installs from the repository root and starts
`@echoverse/server` through the workspace script.
Required environment variables must be declared and reviewed through the
authoritative `project/apps/server/render.yaml`; never replace a secret with a value copied
into a YAML file.

To build a Windows installer locally, run the existing desktop build script
from `project/apps/desktop/` and inspect `tmp/release/desktop/`. Treat the output as an
unverified local artifact until the release checks, integrity metadata, and
signing/publisher decision in [release.md](release.md) pass.

## Make targets

From the repository root, `make help` lists the supported developer entrypoints.
Use `make setup` to install the server, web, and desktop dependencies, and
`make tooling-check` to verify Node.js 22 LTS. Use `make ai-check` for a safe
documentation/metadata gate, `make server-run`
to start the local backend, and `make ai-server-test` in a second terminal to
check its `/health` endpoint. `make release-check` validates version metadata
without creating artifacts; platform-specific `make release-*` targets create
local build output and are not a publication action.

## Disposable work paths

`tmp/` is the single ignored location for generated evidence, build output,
local design notes, environments, runtime databases, and intermediate artifacts.
Its subdirectories are disposable: never store secrets, credentials, production
data, or the only copy of an important result there. `make work-init` creates
the standard directories when needed.

Read the package README and scripts before running a workspace command. Keep
environment files local and use placeholders in examples; never paste real
tokens, cookies, database URLs, or signing keys into Git or issue trackers.

## Version changes

For a desktop-shell release, change root `VERSION`, mirror it in the package
manifests required by tooling, update the roadmap/release notes, run the
metadata and workflow validation, and use a matching `v<value>` tag. For a
web-only change, keep the desktop version unchanged; the web workflow uses the
Git commit SHA as the renderer revision and no installer is required.

## Branches and reviews

Use a focused `docs/<topic>` branch for documentation/governance work unless
the owner explicitly directs another path. Pull requests must state scope,
validation, security impact, and deferred runtime work. Do not commit or push
from an agent session unless explicitly requested. The owner has granted
standing authorization for repository GitHub inspection and for this
repository's GitHub Actions operations, including reading status/logs/artifacts,
dispatching, rerunning, cancelling, and editing workflow definitions, without
separate per-operation approval. Remote pushes still require explicit approval;
protected `main` changes and merges require approval for the exact change.
