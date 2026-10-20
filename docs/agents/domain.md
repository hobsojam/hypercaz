# Domain Knowledge Persistence

## Purpose

AI Hero `domain-modeling` supports persistence inside Superpowers-led
discovery. It records terminology and qualifying decisions that the user and
Superpowers have already settled; it does not start a second discovery
interview or take ownership of design approval.

## Single-Context Repositories

For a single-context repository, use these canonical locations:

- Root `GLOSSARY.md` for shared domain terms.
- Root `docs/adr/` for architectural decision records.

Before planning, read the existing `GLOSSARY.md` and all relevant records in
`docs/adr/`. Reuse established language and decisions rather than introducing
silent synonyms or reopening settled choices.

Update `GLOSSARY.md` only after terminology is settled. Each entry should state
the preferred term, its concise meaning, and any deprecated synonym that would
otherwise cause ambiguity.

Create an ADR only when a decision is consequential, difficult to reverse, and
has genuine trade-offs worth preserving. Do not create ADRs for routine,
low-cost, or easily reversible choices. Record the context, considered options,
decision, consequences, and status using the repository's existing ADR format.

## Multi-Context Repositories

A multi-context repository must provide an explicit map from each bounded
context to its glossary and ADR location. Read and follow that map before
planning. Never guess locations, merge vocabularies across contexts, or create
new context directories without repository-specific direction.

If the map is missing, incomplete, or ambiguous, stop persistence work and ask
for the authoritative context-to-location mapping. Continue Superpowers-led
discovery only without writing domain artifacts until that mapping is settled.
