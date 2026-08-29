<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0019: separate desktop shell and web revision tracks

## Status

Accepted

## Date

2026-08-29

## Decision

EchoVerse uses two release tracks:

1. The desktop shell and product compatibility version is the trimmed root
   `VERSION` value. Workspace package manifests mirror it for tooling. A shell
   release creates the matching `v<version>` tag and platform installers. The
   first release under this policy is `1.8.4`.
2. The deployed web renderer is identified by the full lowercase Git commit
   SHA. The signed UI manifest stores this value as `webRevision`; the browser
   bundle exposes `git-<sha>` for diagnostics. The manifest's semver `version`
   and `minShellVersion` fields remain shell compatibility fields.

The desktop UI cache identity is `(version, webRevision)`. A new web commit
therefore downloads and atomically activates a new verified cache even when the
desktop shell version is unchanged. A new desktop installer is required only
when the native shell, desktop configuration or packaging, `VERSION`, or a
desktop-relevant shared package changes.

`build-desktop.yml` is limited to those desktop-relevant paths. `deploy-web.yml`
builds and publishes the web renderer and signed manifest for web/shared
renderer changes and supplies `GITHUB_SHA` as the web revision. A shell release
also deploys the web renderer because `VERSION` and compatibility metadata are
part of the manifest.

## Security and compatibility

- UI manifest schema 2 requires a lowercase hexadecimal `webRevision` and
  includes it in the Ed25519-signed canonical payload.
- Existing schema-1 caches are rejected and cannot be activated silently.
- The shell still verifies HTTPS, signature, shell compatibility, path
  containment, sizes, and SHA-512 digests before activation.
- A web build cannot require an older shell accidentally: the manifest keeps an
  explicit `minShellVersion`, currently `1.8.4`.
- If a web deployment is unavailable or invalid, the previous verified cache or
  bundled renderer remains the recovery path.

## Consequences

- Web fixes can ship on every Git commit without forcing users to download a
  new installer.
- Native changes retain the existing unattended desktop release/update path.
- Web revisions are identifiers, not semver values; ordering and compatibility
  decisions continue to use shell semver fields.
- Release and deployment checks must report both shell version and web revision.

## Validation

`ui-update.test.ts` covers schema/revision validation, signed downloads, cache
identity, and fallback behavior. The web workflow must publish a manifest whose
`webRevision` equals the source commit SHA, while desktop workflow path filters
must remain limited to the desktop-relevant surfaces.
