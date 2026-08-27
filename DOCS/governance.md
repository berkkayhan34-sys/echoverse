<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Governance and public-release runbook

This document defines the operating roles and the pre-public-release gate. It
does not activate external GitHub settings by itself. The owner must verify
each activation step and retain the resulting evidence before the first public
release.

## Current roles

The current operational owner, release approver, incident coordinator, and
evidence-retention owner is `@berkkayhan34-sys`, the repository owner listed in
[CODEOWNERS](../.github/CODEOWNERS). Delegation is allowed only when the owner
records the delegate, scope, start/end date, and handoff evidence in the
relevant release or incident record. No public contact address is published in
this repository.

| Responsibility                            | Current owner                                    | Required backup/escalation                                                                                                       |
| ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Operations and deployment decision        | `@berkkayhan34-sys`                              | Repository owner retains final decision until a delegate is recorded                                                             |
| Security incident intake and coordination | `@berkkayhan34-sys`                              | Private GitHub Security Advisory; if unavailable, private owner communication described in [SECURITY.md](../.github/SECURITY.md) |
| Release approval                          | `@berkkayhan34-sys` before governance activation | At least one required CODEOWNERS reviewer after public-release activation, plus owner approval for publication                   |
| Evidence retention                        | `@berkkayhan34-sys`                              | A named delegate recorded in the release evidence before transfer                                                                |

## Incident escalation

1. Stop publication or deployment when a release blocker, suspected secret
   exposure, authorization bypass, data-loss risk, or unverifiable artifact is
   found.
2. Preserve only the minimum redacted evidence needed to investigate. Do not
   place secrets, exploit details, private messages, media, or personal data in
   issues, commits, logs, or evidence records.
3. Report suspected vulnerabilities through the private channel in
   [SECURITY.md](../.github/SECURITY.md). The incident coordinator assigns
   severity, scope, owner, and next review time.
4. Contain the affected release, credential, session, integration, or service;
   revoke or rotate credentials through the approved secret boundary when
   applicable.
5. Record the incident ID, affected version/commit, decisions, validation
   results, and unresolved risks. Link the redacted record from the release or
   audit evidence without copying sensitive content.
6. Resume publication only after the coordinator confirms remediation,
   regression/security tests, rollback readiness, and owner approval.

## Public-release activation checklist

Complete and evidence every item before the first public release:

- [ ] Confirm `CODEOWNERS` covers security, release, deployment, architecture,
      licensing, and data changes.
- [ ] Enable branch protection on the release branch: required CODEOWNERS
      review, required passing status checks, no force-push, and no direct bypass
      for ordinary changes.
- [ ] Verify the private security-reporting channel and owner escalation path.
- [ ] Name the operational and evidence-retention delegates if they differ from
      the repository owner; record scope and handoff dates.
- [ ] Confirm the release approver has reviewed the complete diff, security
      impact, deferred work, version, checksums, signing status, and rollback plan.
- [ ] Confirm all release-blocking roadmap children and their evidence records
      are complete; unsigned artifacts remain explicitly non-production-ready.
- [ ] Record the activation revision, workflow results, branch settings,
      approver, and unresolved risks in a release evidence record.

The solo-maintainer exception in
[ADR-0007](decisions/0007-governance-activation.md) remains active until this
checklist is deliberately completed. It does not waive secret handling,
security validation, complete-diff review, or release evidence.

## Release and rollback procedure

1. Prepare the version, package mirrors, changelog, roadmap status, and release
   notes together.
2. Run the full quality, security, artifact, checksum, installer, and rollback
   gates from [testing-policy.md](testing-policy.md) and
   [release.md](release.md).
3. Obtain the required review and explicit publication approval. Local release
   targets must not publish.
4. Publish only the matching `v<version>` tag and retain workflow output,
   artifact checksums, signing status, and known issues.
5. If a gate fails before publication, stop and record the failure. If a
   released artifact or migration is unsafe, stop rollout, preserve the
   evidence, restore the previous known-good release using the documented
   rollback path, and verify health and compatibility.
6. After recovery, record the exact rollback revision, affected artifacts/data,
   user impact, validation, and follow-up roadmap/ADR work.

## Evidence retention

Roadmap evidence belongs under [`evidence/`](evidence/README.md). A release or
incident evidence record must contain the identifier, date, revision, owner,
commands/results, artifact or checksum references, signing status, rollback
state, and unresolved risks. Retain only redacted metadata in Git; keep any
restricted provider logs or artifact copies in the approved access-controlled
system with an expiry and deletion owner. Evidence deletion must itself be
recorded without retaining the deleted sensitive content.
