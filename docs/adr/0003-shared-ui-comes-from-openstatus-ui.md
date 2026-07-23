---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# All shared UI comes from `@openstatus/ui`

## Context and Problem Statement

openstatus has three frontend apps — `dashboard`, `status-page`, and `web` —
that must look and behave like one product. They share a design system built on
shadcn/ui and Radix: primitives (`button`, `input`, `dialog`, `form`, …),
openstatus-specific composite blocks (the status-page components), shared hooks,
and the `cn` class-merge helper.

That shared design system lives in the `@openstatus/ui` package. But each app
also carries its own `components.json` whose `ui` alias points at a *local*
`@/components/ui`. Running `npx shadcn add <component>` inside an app therefore
drops a fresh copy into that app's tree instead of the shared package. Once that
happens the apps drift: divergent `button` variants, divergent `cn`, duplicated
and unpinned Radix dependencies, and a public shadcn registry
(openstatus.dev/r) that no longer matches what the apps actually render.

Where should shared UI components live, and how do we keep apps from forking
their own copies?

## Decision Drivers

- Three apps plus a public registry must render one consistent design system.
- A fix to a primitive should reach every app at once.
- Radix / lucide / recharts versions must be pinned in one place.
- `@openstatus/ui` is the source of truth for the public shadcn registry; local
  forks would make the registry lie.
- Adding a component must not silently create a divergent copy.

## Considered Options

- Each app keeps its own `components/ui` (per-app shadcn install)
- A single shared `@openstatus/ui` package, consumed as source
- Publish `@openstatus/ui` as a versioned, pre-built npm package

## Decision Outcome

Chosen option: "A single shared `@openstatus/ui` package, consumed as source".

**All shared UI comes from `@openstatus/ui`, always.** Apps import it directly
and never keep their own copy of a shared component:

- **shadcn primitives** → `@openstatus/ui/components/ui/<name>`
- **openstatus blocks** → `@openstatus/ui/components/blocks/<name>`
- **custom shared components** → `@openstatus/ui/components/custom/<name>`
- **the `cn` helper and shared utils** → `@openstatus/ui/lib/<name>`
- **shared hooks** → `@openstatus/ui/hooks/<name>`
- **global styles** → `@openstatus/ui/globals`

The package has no build step — apps consume the `.tsx` source through the
`exports` map in `packages/ui/package.json`. Its dependencies are catalog-pinned,
so every app resolves the same Radix/lucide/recharts versions.

**Adding a new shadcn primitive:** add it under
`packages/ui/src/components/ui/`, register it in `packages/ui/registry.json`,
and import it via `@openstatus/ui/...`. Do **not** run `npx shadcn add` against
an app's `components.json` — that targets the app's local `@/components/ui` and
forks the component.

**Scope.** This rule covers *shared* UI: primitives, blocks, hooks, and `cn`.
App-specific feature components (a settings form, a dashboard widget) still live
in the app under `src/components/`. The rule is: if it is a shadcn primitive or
is used by more than one app, it must come from `@openstatus/ui` — never a local
fork.

### Consequences

- Good, because there is one design system and one source of truth; a primitive
  fix propagates to all three apps and the registry at once.
- Good, because Radix and other UI dependencies are pinned once via the catalog.
- Good, because the no-build-step source consumption keeps iteration fast.
- Bad, because a change to a shared primitive affects all three apps
  simultaneously and needs corresponding care in review.
- Bad, because `npx shadcn add` defaults to the app's `components.json`, so
  contributors must know to add primitives in `packages/ui` instead — a sharp
  edge this ADR exists to flag.
- Neutral, because apps must transpile the package source; already configured.

### Confirmation

Code review rejects new files under an app's `src/components/ui/` that
duplicate a shadcn primitive, and rejects imports of a shadcn primitive from
anywhere other than `@openstatus/ui`. New primitives appear under
`packages/ui/src/components/ui/` and in `packages/ui/registry.json`.

## Pros and Cons of the Options

### Each app keeps its own `components/ui`

- Good, because `npx shadcn add` works out of the box with no extra knowledge.
- Bad, because the three apps drift apart component by component.
- Bad, because UI dependencies are duplicated and version-skew across apps.
- Bad, because the public registry no longer reflects the shipped UI.

### A shared `@openstatus/ui` package, consumed as source

- Good, because one source of truth for primitives, blocks, hooks, and `cn`.
- Good, because no build step — fast iteration, simple debugging.
- Good, because it is already the source for the public registry.
- Bad, because `npx shadcn add` has to be pointed at the package deliberately.

### Publish `@openstatus/ui` as a pre-built npm package

- Good, because apps consume a stable, versioned artifact.
- Bad, because every UI change needs a publish + version bump before apps see
  it — slow for a monorepo where UI and apps evolve together.
- Bad, because it adds release tooling for an internal-only consumer.

## More Information

- Package: `packages/ui/` — `src/components/ui` (primitives),
  `src/components/blocks` (status-page blocks), `src/components/custom`,
  `src/lib`, `src/hooks`.
- Registry: `packages/ui/registry.json` + `REGISTRY.md`; built and published to
  `apps/web/public/r/` and served at https://openstatus.dev/r.
- The per-app `components.json` files exist for tooling/registry alignment;
  they are not a license to install primitives locally.
- Related: ADR-0000 (why we keep ADRs).
