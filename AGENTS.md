# AI Hero Planning Integration

## Default Routing

Superpowers is the default workflow. Use the Superpowers-only path unless the
user explicitly requests AI Hero planning. Ambiguous requests do not activate
AI Hero planning.

Accepted explicit activation includes a clear phrase such as `Use AI Hero
planning for this.`, `Use AI Hero planning.`, or `Make AI Hero tickets.`, or
an explicit invocation of `/to-spec` or `/to-tickets`.

## Allowed AI Hero Skills

AI Hero use is limited to this allowlist:

- `setup-matt-pocock-skills`, only during repository setup; do not invoke it as
  part of normal per-feature activation.
- `domain-modeling`
- `/to-spec`
- `/to-tickets`

Never install, retain, or invoke `ask-matt`. If it appears in an installed or
generated skill tree, manifest, link, or lock or source metadata, stop and
reject it before any AI Hero planning session.

Do not install, invoke, or rely on any other AI Hero skill. AI Hero
implementation, TDD, debugging, and review skills are prohibited.

## Tracker Preflight

Before invoking `/to-spec` or `/to-tickets`, confirm that
`docs/agents/issue-tracker.md` exists, is readable, contains a complete tracker
configuration, and has been read for the current task. If it is missing,
incomplete, or unreadable, stop and request repository setup. Create no
planning artifact and never fall back to `.scratch`, GitHub Issues, or another
tracker backend.

## Workflow Ownership

Superpowers owns discovery and in-chat design approval. During that discovery,
AI Hero `domain-modeling` may persist settled terminology and qualifying
architecture decisions; it is a persistence helper, not a second interview.

After Superpowers design approval, AI Hero `/to-spec` replaces only the
overlapping Superpowers design-spec stage for the selected feature. AI Hero
`/to-tickets` replaces only the overlapping `superpowers:writing-plans` stage
for that feature. Do not create duplicate specifications, plans, or ticket
sets.

Superpowers retains ownership of worktrees, TDD, review, verification, and
completion.

## Ticket Execution

Execute tickets sequentially by default. Run tickets in parallel only when the
user explicitly opts in, every selected ticket has resolved blockers, and the
implementation surfaces do not overlap. Assess overlap from the planned edits
and repository structure independently of dependency metadata; a missing
dependency does not prove that parallel execution is safe.

## Canonical Instructions and Ambiguity

Install this policy in `AGENTS.md`. When `CLAUDE.md` also exists, `AGENTS.md`
is canonical for this integration. `CLAUDE.md` may retain unrelated repository
instructions and may point to `AGENTS.md`, but it must not duplicate, override,
or claim authority over this integration policy.

If ownership of an artifact or workflow stage is ambiguous, stop and ask the
user to declare the authoritative owner before creating or changing the
artifact.
