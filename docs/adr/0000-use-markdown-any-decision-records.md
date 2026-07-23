---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# Use Markdown Any Decision Records (MADR)

## Context and Problem Statement

openstatus is a pnpm + Turborepo monorepo spanning a Next.js dashboard, a Hono
API server, a Go checker, and ~25 shared packages. Architecturally significant
decisions — the services layer, API-key scopes, the move to Effect-based
fetchers, framework choices — currently live only in PR descriptions, commit
messages, and `CLAUDE.md`. That makes the *why* behind a decision hard to find
and easy to lose when contributors change.

How should we record architecturally significant decisions so the reasoning,
the alternatives, and the trade-offs stay discoverable over time?

## Decision Drivers

- The reasoning behind a decision must outlive the PR that introduced it.
- New contributors need a single place to learn "why is it built this way?".
- The format must be lightweight enough that writing an ADR is not a chore.
- Records should be diff-friendly and reviewable like code.

## Considered Options

- Markdown Any Decision Records (MADR)
- Nygard-style lightweight ADRs
- A wiki / Notion page for architecture decisions
- Keep relying on PR descriptions and `CLAUDE.md`

## Decision Outcome

Chosen option: "Markdown Any Decision Records (MADR)", because it lives in the
repo next to the code, is reviewed through the normal PR process, and its
template explicitly prompts for *decision drivers* and *considered options* —
the parts most often lost when a decision is only captured in a commit message.

ADRs are stored in `docs/adr/`, named `NNNN-kebab-case-title.md` with a
zero-padded, monotonically increasing number. `template.md` is the MADR
template. This file, ADR-0000, is the first record.

### Consequences

- Good, because decision history is versioned, searchable, and offline.
- Good, because the template's prompts produce consistent, comparable records.
- Bad, because contributors must remember to write an ADR for significant
  decisions; this is mitigated by the checklist in `README.md`.

### Confirmation

A new ADR is added under `docs/adr/` whenever a decision matches the "When to
write an ADR" criteria in `docs/adr/README.md`, and is reviewed in the same PR
as (or just before) the change it describes.

## More Information

- MADR project: https://adr.github.io/madr/
- ADR overview: https://adr.github.io/
- `CLAUDE.md` remains the home for *current* conventions an agent must follow;
  ADRs explain *why* those conventions exist and what was rejected.
