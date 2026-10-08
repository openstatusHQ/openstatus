# AGENTS.md — apps/checker

Go 1.25, the only non-TypeScript tier in the repo along with
`apps/private-location`. It probes customer endpoints from ~35 fly.io regions on
512 MB VMs and writes results straight to Tinybird.

Constraints:

- **Keep Go scoped to probing.** Product and workspace logic belongs in
  `packages/services`. The two sides talk through data contracts only — Tinybird
  rows and protobuf (`packages/proto`) — never shared in-process code.
- **Assertion evaluation exists twice**: `apps/checker/pkg/assertions` (Go) and
  `packages/assertions` (TypeScript). So do region codes. Changing one without
  the other silently diverges what the probe checks from what the dashboard
  shows — move both in the same PR and say so in the description.
- `pnpm verify` does not cover this app. Run `go test ./...` from
  `apps/checker`; CI runs it in `.github/workflows/go-tests.yml`.
- Per-phase timings (DNS, connect, TLS, TTFB, transfer) come from `httptrace`.
  They are a product surface, not diagnostics — do not drop or rename fields.
