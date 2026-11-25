# @openstatus/icons

Single import surface for icons across the openstatus apps.

- `@openstatus/icons` — the app icon set (lucide-backed by default)
- `@openstatus/icons/nucleo` — same names, Nucleo-backed where vendored; selected
  at build time by setting `ICON_SET=nucleo` (aliased in each app's `next.config.ts`)
- `@openstatus/icons/brand` — third-party brand/logo icons (GitHub, Slack, …)

Both sets must export identical names — enforced by `src/parity.ts` at compile time.

Nucleo icons are used under the [Nucleo license](https://nucleoapp.com/license)
(max 100 icons in open-source projects, with copyright notice). With the approval from [Sebastiano Guerriero](https://x.com/guerriero_se), we have the authorization to add up to 140-150 icons.

## Licensing

This package is `private` and not published to npm.

- Package source, `src/lucide/` and `src/brand/`: MIT (lucide re-exports remain
  under the [lucide ISC license](https://lucide.dev/license)).
- `src/nucleo/`: vendored [Nucleo](https://nucleoapp.com) icons, copyright Nucleo,
  used under the [Nucleo license](https://nucleoapp.com/license) — see `src/nucleo/NOTICE`.
  These icons may **not** be extracted, redistributed, or resold outside of openstatus.
