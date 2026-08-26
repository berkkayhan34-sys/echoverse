<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Release workflow

## Canonical version

The only authoritative product version is the trimmed contents of the root
[`VERSION`](../VERSION) file. `package.json`, `server/package.json`,
`web/package.json`, and `desktop/package.json` are mirrors for tooling. A
release is blocked if a mirror differs, if the Git tag is not `v<version>`, or
if a workflow uses a hardcoded product version.

## Release preparation

1. Confirm the working tree and intended diff contain no secrets, personal data,
   generated output, or unrelated changes.
2. Update `VERSION`, package mirrors, roadmap status, and changelog/release
   notes in one reviewed change.
3. Run documentation/metadata checks, package checks, tests, security scans,
   and production builds required by [testing policy](testing-policy.md).
4. Verify artifact names, embedded version, checksums, and installer launch.
5. Confirm artifact checksums, publisher trust, and rollback evidence. The
   current decision uses GitHub Releases plus checksums; because platform
   signing is not yet selected, unsigned artifacts must not be called
   production-ready.

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
