# AGENTS.md — @openstatus/ui

Three directories under `src/components/`, three different contracts. Getting
the wrong one is the most common mistake here.

| Directory | What it is | Who else sees it |
|---|---|---|
| `ui/` | Stock shadcn/ui primitives | Nobody — never shipped |
| `blocks/` | The openstatus shadcn registry (status page) | Every external consumer |
| `custom/` | openstatus-only components | Our apps only |

`blocks/README.md` documents the composition API and `REGISTRY.md` the publish
flow. This file is only the rules those two assume you already know.

## Do not customize `src/components/ui/`

These 41 files are shadcn's, and the registry ships **zero** of them. Blocks
instead declare `registryDependencies: ["button", "tooltip", …]`, which resolve
to the **consumer's own** shadcn components at install time.

So a block that depends on a local tweak to `button.tsx` renders correctly in
this repo and incorrectly for everyone who installs it — with no error anywhere.
Patching also means the next `shadcn add` either clobbers the change or silently
skips the upgrade.

When a primitive isn't enough, in order of preference: pass `className`, compose
a wrapper in `blocks/` or `custom/`, or add a variant to the block that needs it.

Editing a `ui/` file is a last resort, and only for a defect stock shadcn has
too. `input-group.tsx` is the precedent — `FormControl`'s Slot injected a
`data-slot` that clobbered the group's own, breaking the focus ring. It carries
a comment saying why the prop order matters. Do the same, or don't touch them.

## `blocks/` is a published registry, not internal code

Anything you add here ends up on `openstatus.dev/r` and gets installed into
codebases that are not this one.

- **Register it.** A new file needs an entry in `registry.json` with its
  `registryDependencies`. Forget that and it works in the monorepo and 404s for
  consumers — nothing in CI catches it.
- **No app imports.** No `next/link`, no `next-intl`, no `@openstatus/db`, no
  tRPC. Every direct dependency becomes a mandatory install for consumers, and
  most of them aren't even on Next.js. Routing, markdown and translation come in
  through slot props (`renderEvent`, `renderMessage`, `asChild`) and the
  `StatusBlocksI18nProvider` context.
- **Imports must exist in a stock shadcn install.** `pnpm registry:build`
  rewrites `@openstatus/ui/*` to `@/*`, so `@openstatus/ui/components/ui/button`
  becomes `@/components/ui/button` on the consumer's machine. Importing a
  primitive we have but they don't produces a build error there, not here.
- **New color tokens go in `registry.json` `cssVars`.** That is how `--success`,
  `--warning` and `--info` reach consumers; a token used only in `globals.css`
  is undefined for them.
- **Defaults must render unconfigured.** Slots are optional, i18n falls back to
  English. The registry preview has no wiring.

## Border radius

`globals.css` defines the scale as ratios of the themed `--radius`, anchored so
the 0.625rem default keeps shadcn's pixel values: `xs` 0.2 (2px), `rounded` 0.4
(4px), `sm` 0.6 (6px), `md` 0.8 (8px), `lg` 1.0 (10px, the base), `xl` 1.4
(14px). Stock shadcn subtracts fixed pixels instead (`calc(var(--radius) -
4px)`), which collapses whole steps to 0 on the status page, where a theme can
set `--radius` to 0.25rem or 0.

Never hard-code a radius, and prefer `rounded-lg` over the equivalent
`rounded-(--radius)`. `rounded-full` is only for a chip that wraps a glyph
(`StatusIcon`); a coloured status marker takes `rounded-lg` so it matches the
bar it describes.

In `blocks/`, bare `rounded` is off-limits: its 0.4 ratio comes from our
`globals.css`, and a consumer's stock Tailwind resolves it to a fixed 0.25rem.
`lg`/`md`/`sm` are safe — shadcn defines those keys too.

The ratios deliberately stay out of `registry.json` `cssVars`. `--success` and
friends are tokens a consumer lacks; `--radius-sm` is one they already have, and
overwriting it would reshape every button and card in their app because they
installed a status block. Installed blocks follow the host's scale — see
`REGISTRY.md` for the snippet consumers can opt into.

## Generated output

`dist/` and `public/r/` are build artifacts of `pnpm registry:build` (which
`apps/web`'s build runs). Both are gitignored. Never edit them, and never fix a
registry bug by editing `dist/` — change `src/` and rebuild.

## Imports

Exports are path-based, with no barrel:
`@openstatus/ui/components/ui/button`, `@openstatus/ui/components/blocks/status-bar`,
`@openstatus/ui/hooks/use-media-query`. Import the exact file.

Shared UI belongs here, not forked into an app — see `docs/adr/0003-shared-ui-comes-from-openstatus-ui.md`.
