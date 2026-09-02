<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `PARITY-005`

```yaml
id: PARITY-005
status: in_progress
date: 2026-09-02
revision: working-tree (codex/parity-001-2-notifications-unread)
```

## Scope implemented

- Web and Electron renderers elect a single guild-voice offerer from the
  server-assigned socket IDs, preventing simultaneous offer glare.
- Peer creation is serialized per socket pair and early ICE candidates are
  queued until the remote description exists, with a bounded queue.
- Joining a guild lobby acquires a live microphone during the explicit join
  action; ended microphone tracks are reacquired and replaced on active peer
  senders.
- Reconnect and foreground transitions request server lobby truth and schedule
  bounded peer recovery for failed or disconnected connections.
- Private-call signaling authorization remains server-enforced; the new guild
  recovery scheduler is gated by guild lobby membership and does not restart
  private-call peers.

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | pass | 27 test files, 154 tests; includes deterministic offerer policy and server WebRTC authorization/stale-signal coverage. |
| `npm run typecheck` | pass | All workspace packages typechecked. |
| `npm run build` | pass | Web, Electron renderer/preload, server, and shared packages built. |
| `npm run localization:check` | pass | 423 localization keys verified. |
| `npm run reuse:check` | pass | 364/364 files compliant with GPL-3.0-only metadata. |
| `npm run secret-scan` | pass | 142 commits scanned; no leaks found. |
| `node DOCS/tools/validate-roadmap.mjs` | pass | Roadmap/evidence links and status structure verified. |
| `git diff --check` | pass | No whitespace errors. |
| `npm run lint` | pre-existing findings | Ten unused-variable findings remain in `project/packages/shared-ui/src/workspace.tsx`; no finding is in the voice changes. |

## Live hosted verification (2026-09-02)

The selected test target was the MacBook-hosted `https://echoverse.borayarkin.net`
endpoint. The health endpoint reported server version `1.9.9`; it does not match
the current working-tree revision, so this run is a hosted baseline rather than
proof of the local changes above.

| Scenario | Result | Observation |
| --- | --- | --- |
| Two independent authenticated sessions | pass | `test` (in-app browser) and `test2` (Edge) reached the EchoVerse main guild. |
| Same-lobby join | partial | Edge showed `ÇEVRİMİÇİ — 2`; the first session did not receive the matching participant update and showed `ÇEVRİMİÇİ — 0`. |
| Identity rendering | fail | The Edge participant list rendered the remote and local entries as `test2`/`test2 (sen)` instead of distinct identities. |
| Inbound media | fail / unverified | The Edge page exposed a remote video stream with one video track and zero audio tracks; the first session exposed no media stream. No non-zero inbound audio was observed. |
| Chat cross-client delivery | fail | A message entered in the first session remained in the composer after clicking `Gönder` and appeared in neither client; the earlier pre-transition smoke message is not reused as acceptance proof. |

Screenshots of both live sessions were displayed during the test and retained
at `tmp/test-results/PARITY-005-hosted-test.png` and
`tmp/test-results/PARITY-005-hosted-test2.png`. They show the asymmetric
participant counts and the absence of an audio-bearing stream. The browser
permission state was `prompt` for `test` and `granted` for `test2`; no
permission was forced through hidden browser state.

The local server could not be started on this Windows host because the Node
runtime fails in `uv_os_get_passwd` with `ENOMEM` before EchoVerse loads. Existing
historical audio-path screenshots in `tmp/test-results/bug002-*-voice-connected.png`
are retained as prior evidence but are not treated as current acceptance proof.
The local renderer itself loaded and rendered the sign-in surface; a screenshot
is retained at `tmp/test-results/PARITY-005-local-renderer-login.png`.

PARITY-005 MUST remain incomplete until the working-tree revision is deployed
to the selected host and a repeatable two-client test records non-zero inbound
audio on both clients, distinct identities, leave/rejoin behavior, private-call
isolation, and the non-member/stale-socket failure cases.

## Security and recovery notes

No signaling authorization was weakened. The server continues to relay guild
offers, answers, and ICE only between authenticated sockets in the same active
voice lobby. Recovery is bounded, clears timers on teardown, and does not
persist media or credentials.
