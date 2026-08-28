<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Current audit and deferred-work roadmap

This is the authoritative tracker for the current EchoVerse baseline. The
completed v1.8 through v2.1 baseline children are archived in the
[completed-baseline reference](historic/roadmap/completed-baseline.md), with
their original evidence records retained under [`evidence/`](evidence/).

The purpose of this pass is to finish the current audit record, not to declare
the product ready for public release. The owner has explicitly deferred the
remaining release-readiness work until the project is deemed complete. The
final child below is therefore a reference register, not active implementation
work. Future feature or change requests will be added as separately ordered
children after that owner decision; they must not be silently folded into this
historical baseline.

Every current child has a stable ID, one checkbox, machine-readable metadata,
and an evidence link or `null`. Allowed status/checkbox pairs are
`incomplete`/`[ ]`, `in_progress`/`[-]`, `deferred`/`[ ]`, and
`complete`/`[x]`. A deferred child is intentionally not active and is excluded
from the first-active-child rule. Before working on
an incomplete child, change its status to `in_progress` and its checkbox to
`[-]`. A complete child requires implementation, applicable tests, security
review, documentation, and evidence. A deferred child must identify what is
deferred and the owner condition that makes it eligible for scheduling.

## Current baseline

The shipped baseline is product version `1.7.5`, with protocol major version 2.
The completed documentation, quality, runtime, localization, modular-boundary,
installer/update, observability, and reliability work is a historical
reference, not an open implementation queue. Local SQLite validation and CI
PostgreSQL validation remain the approved database split. Web acceptance is
complete for the current baseline; desktop development-runtime verification,
release signing, and public-release readiness remain explicitly deferred.

## Audit closure

### audit-closure-and-documentation-pass

```yaml
id: AUDIT-002
type: documentation_audit
status: complete
evidence: evidence/AUDIT-002.md
blocks_roadmap: true
```

[x] Reconcile the active roadmap with the completed baseline, archive completed
children without losing their evidence, create one final deferred-work
reference for owner-approved follow-up, reconcile the canonical navigation and
decision records, and verify the repository with the required documentation,
quality, build, security, and deployment-manifest checks.

## Final deferred work reference

### post-completion-deferred-work

```yaml
id: DEFER-001
type: deferred_work_reference
status: deferred
evidence: null
blocks_roadmap: false
deferred_until: owner declares the current project baseline complete
```

[ ] After the owner declares the current project baseline complete, schedule
the following as explicit, independently evidenced roadmap work:

- `OPS-003`: select and implement Windows publisher signing plus Apple code
  signing/notarization; verify publisher identity and updater artifacts in CI;
  retain checksums and provenance; document key rotation and rollback. The
  required signing identities, provider decision, and protected CI credentials
  are not currently available.
- `OPS-004`: publish support, incident-response, release-evidence,
  artifact-retention, known-issues, and rollback procedures for each shipped
  version.
- `READY-001`: run the final public-release readiness gate only after the
  preceding deferred release work is complete, governance is activated, and
  the owner approves the result.
- Complete desktop Electron development-runtime and interactive acceptance
  that the owner intentionally deferred while web acceptance was sufficient
  for the baseline.
- Add export/import behavior and its hostile-input, compatibility, deletion,
  and recovery evidence if that product boundary is approved.
- Revisit any new audit findings, features, or requested changes introduced
  after this baseline. Each must be added as a new confirmed child with its own
  requirements, tests, security review, documentation, and release impact;
  this reference does not pre-approve future scope.

Until this child is activated by the owner, unsigned desktop artifacts remain
validation-only and must not be called production-ready. No release,
deployment, signing, or feature implementation is implied by this reference.

## Roadmap operation after the baseline

The next authorized change should be a specific feature addition or behavior
change. It must be recorded as a new roadmap child or equivalent owner-approved
change record before implementation, preserving the repository’s requirement,
acceptance, security, validation, documentation, and release gates.

## Release/version rule

The root [`VERSION`](../VERSION) file remains the canonical product version.
Every release must update package mirrors, changelog/release notes, roadmap
status, checksums, and workflow evidence together, then publish only the
matching `v<version>` tag as described in [release.md](release.md).
