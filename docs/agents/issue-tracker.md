# Shared Markdown Issue Tracker

## Authority and Storage

This document defines the repository's planning backend for AI Hero
specifications and tickets. Run all tracker operations from inside the target
Git repository.

Resolve the shared Git directory with:

```text
git rev-parse --path-format=absolute --git-common-dir
```

Treat the command's absolute result as `<git-common-dir>` and use
`<git-common-dir>/aihero-tracker` as the only tracker root. Stop and report the
failure if Git common-directory resolution fails, returns an empty value, or
does not identify a writable location. Before publishing or updating records,
confirm that the tracker root can be created if absent and written if present.
Do not create partial records when that check fails. Never fall back to a
worktree-local `.scratch` directory or any other storage location.

## Feature Layout

Store each feature below a stable, repository-unique feature slug:

```text
<git-common-dir>/aihero-tracker/
└── <feature-slug>/
    ├── claims/
    │   └── <ticket-id>.lock/
    ├── spec.md
    └── issues/
        ├── 01-<ticket-slug>.md
        └── 02-<ticket-slug>.md
```

Publish one approved feature specification as `spec.md`. Reserve a new feature
slug by atomically creating its feature directory with a create-if-absent
directory operation. Never silently replace an existing feature directory:
resume the existing feature or obtain explicit approval to replace it. Create
one Markdown file per tracer-bullet ticket under `issues/`, using a zero-padded
numeric prefix that remains stable for the life of the ticket.

## Canonical Ticket Record

Every ticket begins with exactly one header containing these fields:

```markdown
# <ID>: <Title>

- ID: `<feature-slug>-NN`
- Spec: `../spec.md`
- Status: `open`
- Blocked by: `none`
- Claimed by: `none`
- Updated: `YYYY-MM-DDTHH:MM:SSZ`
```

`ID` is immutable. `Spec` links to the originating specification. `Status` is
one of `open`, `claimed`, `blocked`, or `complete`. `Blocked by` contains
stable ticket IDs, stable non-ticket blocker IDs such as `external:<slug>`, or
`none`. `Claimed by` contains a unique actor or session identifier while work
is owned, otherwise `none`, and must mirror the owner metadata in the ticket's
claim lock. `Updated` records the latest record change in UTC.

After the header, maintain these sections:

```markdown
## Acceptance Criteria

## Notes

## Verification Evidence
```

Append progress, failure, and review notes instead of rewriting history.
Verification evidence must name the current command or review performed, its
result, and when it ran.

## Tracker Operations

The Markdown backend implements the complete tracker contract as follows:

1. **Publish a specification.** Atomically create `<feature-slug>/` with a
   create-if-absent directory operation before writing any child. Directory
   creation must fail when the path already exists; never overwrite, rename
   over, or delete an existing feature directory as a fallback. Only the
   winning publisher creates `claims/`, `issues/`, and the approved `spec.md`,
   then re-reads the complete specification. A losing publisher makes no
   tracker edit and stops for explicit resume-or-replace direction.
2. **Create tickets.** Write one `issues/NN-<ticket-slug>.md` record for each
   approved tracer-bullet ticket. Each ticket must be a vertical slice that
   produces independently useful behavior and must contain populated,
   independently verifiable acceptance criteria. Reject the ticket set before
   publication if any ticket is only a horizontal layer, has empty criteria,
   or cannot be verified independently.
3. **Assign stable IDs.** Derive the immutable `ID` from the feature slug and
   numeric file prefix; never reuse or renumber an ID.
4. **Link the specification.** Set every ticket's `Spec` field to its
   originating `spec.md` record.
5. **Record and resolve blockers.** Put stable ticket or non-ticket blocker IDs
   in `Blocked by`, set `Status` to `blocked`, and append the reason. Before
   listing ready work, re-evaluate blocked tickets. A ticket dependency is
   resolved only when its ticket is `complete`; a non-ticket blocker is
   resolved only when `Notes` contains explicit timestamped resolution evidence.
   When every blocker is resolved, persist `blocked -> open`, update `Updated`,
   and append the evidence used. Never resume directly from `blocked` to
   `claimed`.
6. **List the ready frontier.** After blocker re-evaluation, read all issue
   records and list, in ascending numeric order, tickets whose status is
   `open`, whose blockers are resolved, whose `Claimed by` field is `none`, and
   whose claim-lock path does not exist.
7. **Claim before implementation.** Select the lowest-numbered ready ticket and
   atomically create `<feature-slug>/claims/<ID>.lock` with a create-if-absent
   directory operation. Directory creation must fail when the path already
   exists; never overwrite, rename over, or delete an existing lock as a
   fallback. Only the actor whose create succeeds writes its unique owner and
   timestamp inside the lock. That actor then re-reads the ticket, releases its
   new lock and stops if the ticket is no longer ready, otherwise sets `Status`
   to `claimed`, sets `Claimed by` to the same owner, updates `Updated`, and
   persists the record. Start implementation only after re-reading both the
   ticket and lock and confirming the same owner and resolved blockers.
8. **Append notes.** Add timestamped progress, failure, and review entries to
   `Notes` without erasing earlier entries.
9. **Complete after verification.** Run current verification, append its
   evidence, then set `Status` to `complete`, clear `Claimed by`, and update
   `Updated`, then remove the matching claim lock. If verification fails or is
   stale, append the failure evidence and choose one explicit path. Retain
   `claimed`, `Claimed by`, and the matching lock only when the same owner will
   continue the claimed work. To stop work on a blocker, append its stable ID,
   persist `Status: blocked`, clear `Claimed by`, update `Updated`, and then
   remove only the matching owner's lock. A blocked ticket never retains claim
   ownership or a claim lock; operation 5 must later persist `blocked -> open`
   before it can re-enter ordered selection and acquire a new lock. An explicit
   abandonment follows the same release sequence and sets the ticket to `open`
   or `blocked` according to current blockers. Treat a lock with missing or
   stale owner metadata as held until a human reviews the ticket, actor
   evidence, and timestamps and explicitly authorizes recovery; never reap it
   automatically.

## Refusal Rules

- Refuse to claim a ticket with unresolved blockers.
- Refuse a claim when atomic lock creation fails, a claim lock already exists,
  or another actor is recorded in `Claimed by`.
- If the persisted ticket or lock owner differs when re-read, report the
  competing claim, release only a lock owned by the current actor, and stop
  before implementation.
- Refuse direct `blocked -> claimed`; resolved blockers must first be evidenced
  and persisted as `blocked -> open` before normal ordered selection.
- Refuse a `claimed -> blocked` transition that does not clear `Claimed by` and
  remove the matching owner's lock after the blocked state is persisted.
- Refuse `open` directly to `complete`; a ticket must be claimed first.
- Refuse completion without current verification evidence.
- Stop rather than switching storage when path resolution or write access
  fails.
