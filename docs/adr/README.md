# Architecture Decision Records

This directory holds the architecturally significant decisions made on
openstatus, in [MADR](https://adr.github.io/madr/) format.

An ADR captures *why* a decision was made, what alternatives were weighed, and
what trade-offs were accepted. `CLAUDE.md` documents the conventions in force
today; ADRs explain how those conventions came to be.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0000](0000-use-markdown-any-decision-records.md) | Use Markdown Any Decision Records (MADR) | accepted |
| [0001](0001-business-logic-lives-in-the-services-layer.md) | Workspace business logic lives in a framework-agnostic services layer | accepted |
| [0002](0002-use-effect-for-retry-policies.md) | Use Effect for retry policies | accepted |
| [0003](0003-shared-ui-comes-from-openstatus-ui.md) | All shared UI comes from `@openstatus/ui` | accepted |
| [0004](0004-go-for-the-probing-tier.md) | Go for the probing tier | accepted |
| [0005](0005-turso-for-app-data-tinybird-for-time-series.md) | Turso for application data, Tinybird for time-series | accepted |

## When to write an ADR

Write one when a decision is hard to reverse, cross-cutting, or non-obvious —
for example:

- adopting or dropping a framework, library, or runtime;
- a repo-wide pattern every contributor must follow;
- a data-model or API-contract decision that is expensive to change;
- choosing one approach over a reasonable alternative someone would ask about.

Skip it for routine, local, or easily reversible changes.

## How to add one

1. Copy `template.md` to `NNNN-kebab-case-title.md`, where `NNNN` is the next
   zero-padded number.
2. Fill it in. Keep it short — drivers, options, outcome, consequences.
3. Add a row to the index above.
4. Open it in the same PR as (or just before) the change it describes.

## Changing a decision

ADRs are immutable once accepted. To change a decision, write a new ADR and set
the old one's `status` to `superseded by ADR-NNNN`.
