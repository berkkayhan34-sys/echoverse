<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Release workflow

## Canonical version

The only authoritative product version is the trimmed contents of the root
[`VERSION`](../VERSION) file. `package.json`, `project/apps/server/package.json`,
`project/apps/web/package.json`, and `project/apps/desktop/package.json` are mirrors for tooling. A
release is blocked if a mirror differs, if the Git tag is not `v<version>`, or
if a workflow uses a hardcoded product version.

## Release preparation

1. Confirm the working tree and intended diff contain no secrets, personal data,
   generated output, or unrelated changes.
2. Update `VERSION`, package mirrors, roadmap status, and changelog/release
   notes in one reviewed change.
3. Run documentation/metadata checks, package checks, tests, security scans,
   and production builds required by [testing policy](testing-policy.md).
4. Verify artifact names, updater metadata, embedded version, blockmaps,
   checksums, and installer launch. The desktop package exposes the explicit
   `ECHO_VERSE_SMOKE_TEST=1` startup check used by the platform workflows.
5. Confirm artifact checksums, updater failure recovery, publisher trust, and
   rollback evidence. CODE-008 verifies that rejected updates preserve the
   known-good installed version; binary rollback after an installer failure is
   part of the later public-release readiness gate. The current decision uses
   GitHub Releases plus checksums; because platform signing is not yet selected,
   unsigned artifacts must not be called production-ready.

Packaged desktop startup checks the matching GitHub Release before creating the
tray or application window. If an update is available, it downloads and
invokes the silent installer automatically. The install command reuses the
existing installation directory and the updater's administrative-rights
metadata, so the established per-user or per-machine scope is retained.
Release validation must cover this no-UI path on every supported desktop
platform; a failed or timed-out check must leave the known-good version
launchable.

## Automation contract

GitHub Actions reads `VERSION`, validates package mirrors, builds each target,
and publishes only the matching `v<version>` release. Workflow files must not
reintroduce independent version constants. A failed validation stops the
workflow before publishing.

For local preparation, run `make release-check` first. Platform-specific build
targets are `make release-win`, `make release-mac-intel`, and
`make release-mac-arm64`; the `make release` alias currently means the Windows
target. These targets create local artifacts only and do not publish a GitHub
release.

## No accidental publication

Every local desktop `dist:*` and `release:*` script must invoke
`electron-builder` with `--publish never`. Publication belongs only to the
explicit GitHub Release workflow after its version, test, artifact, checksum,
and approval gates pass. A local build must never require a GitHub token or
create a release as a side effect. The macOS Intel release script is included
in this rule even though it also has a publishing-capable electron-builder
profile.

All CI and release workflows use Node.js 22 LTS and install the canonical root
workspace with `npm ci`; workspace-specific build commands run only after that
installation. A workflow or script that uses a different Node version, an
app-local lockfile, or an implicit publish action is a release-blocking drift.

## Approval and rollback

Tagging and publishing are external side effects and require owner approval.
Keep the previous known-good release available. If an artifact, migration,
security check, or installer smoke test fails, stop publication, record the
failure, and use the documented rollback path; do not silently replace an
artifact with an unverified build.

## Post-release

Record the released version, commit/tag, artifact checksums, workflow evidence,
known issues, and any follow-up ADR/roadmap items. Update documentation when
the shipped behavior changes; do not describe planned work as released.
