<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0018: signed remote UI cache for the desktop shell

## Status

Accepted

## Decision

The Electron application keeps its native shell, preload bridge, updater, and
last-known-good bundled renderer locally. The renderer may be refreshed at
startup from the signed web UI manifest published with the GitHub Pages build.
The desktop client never loads an arbitrary live URL as its application page.

The web build publishes `ui-manifest.json` with a bounded file list, SHA-512
digests, a minimum compatible shell version, and an Ed25519 signature. GitHub
Actions signs the manifest with `ECHO_VERSE_UI_SIGNING_KEY`; the corresponding
public key is compiled into the desktop shell. The client requires HTTPS,
validates the manifest and signature, downloads only same-origin relative
paths, verifies every size and digest, and installs the cache with a staging
directory plus atomic pointer update.

If the network, manifest, signature, compatibility check, download, or cache
write fails, the client uses the previous verified cache. If no verified cache
exists, it uses the bundled renderer. A failed UI update must never prevent the
known-good desktop shell from opening.

The native Electron updater remains responsible for shell/security changes and
continues to use the existing signed-release policy. UI and shell versions are
reported separately for diagnostics; `VERSION` remains the canonical product
release version.

## Security and compatibility invariants

- The private signing key is a GitHub Actions secret and is never committed.
- The renderer has context isolation and no Node integration; the preload
  bridge remains the only native capability boundary.
- Cached paths are relative, bounded, and contained inside the per-user cache.
- A UI package is activated only after every listed file passes size and
  SHA-512 checks and the manifest signature verifies.
- A manifest cannot require a newer shell than the installed app.
- Navigation away from the local renderer and new-window creation are denied.
- The web workflow rebuilds when shared browser-safe packages change.

## Consequences

- UI fixes can ship without rebuilding a native installer.
- Desktop startup remains usable during temporary web or CDN outages.
- The UI cache introduces a second version dimension and requires compatibility
  discipline between the shell bridge and web renderer.
- Rotating the signing key requires a shell release containing the new public
  key; the current key identity and rotation procedure must remain protected
  operational data.

## Validation

`project/apps/desktop/electron/ui-update.test.ts` covers signature rejection,
path validation, atomic verified downloads, and fallback to the known-good
cache. Release and quality workflows must publish and validate the signed
manifest before desktop artifacts are released.
