# @openstatus/tinybird

Tinybird holds the monitoring time-series: every check result the probing tier
produces lands here. Turso (see `packages/db`) holds application data. The two
are linked by id only — no join across the boundary.

This package is two things:

- **Datafiles** (`datasources/`, `materializations/`, `endpoints/`) — the schema
  and queries, deployed with the `tb` CLI.
- **A typed client** (`src/client.ts`) — zod-validated wrappers over the
  published endpoints, consumed by the apps.

## Now on Tinybird Forward

This project has migrated from Tinybird Classic to **Tinybird Forward**. If you
last touched it under Classic, these are the changes that matter:

| Classic | Forward |
| --- | --- |
| `pip install tinybird-cli` | `pip install tinybird` (or `uv tool install tinybird`) — currently 4.6.14 |
| `tb push` / `tb pull` | `tb deploy` — no push command exists anymore |
| Resources updated in place | Deployments: build a staging one, then promote |
| New `VERSION` + backfill pipes per schema change | Change the schema in place; add `FORWARD_QUERY` when existing rows need transforming |
| Datafiles anywhere | `datasources/`, `materializations/`, `endpoints/` |

The old `_migration/` folder and its `VERSION`-bumping recipe are gone. Nothing
in this repo uses `tb push`.

> `tb migrate-to-forward` exists in the CLI for workspaces still on Classic.
> This one is already migrated — you do not need it.

## Deploying to Tinybird Cloud

From this directory, after `tb login`:

```bash
tb --cloud deploy --check           # validate; changes nothing
tb --cloud deployment create --wait # build staging, run any backfills
tb --cloud deployment promote       # go live
```

`tb --cloud deploy` collapses the last two into one step. Prefer the split form
when the diff touches a materialized view: `create` is where data gets copied,
and you get to see it land before promoting. `tb --cloud deployment discard`
throws a staging deployment away.

## Changing a schema

Materialized views are the sharp edge. A `.pipe` under `materializations/` and
its target `.datasource` must agree on **both** column names and order, so a
column added to a source datasource has to be added in three places:

1. the source `.datasource`,
2. the target `mv__*.datasource` schema,
3. the `SELECT` in the `aggregate__*.pipe` that feeds it.

Never write `SELECT *` in a materialization. It silently breaks the next time a
column is added to the source — the pipe starts producing a column the target
has no slot for, and the deploy fails.

When the target datasource already exists in the cloud, `deployment create`
repopulates it by re-running the materialized pipe over the source, so
historical rows get real values rather than nulls. Check the "Data that will be
copied with this deployment" table in `--check` output to confirm. That
repopulation is not free — it re-materializes the full retention window.

Adding a nullable column, or a non-nullable one whose ClickHouse default is
acceptable for old rows, needs nothing extra. Use `FORWARD_QUERY` when existing
rows need a real transformation — a genuine default, a type change, a rename:

```
FORWARD_QUERY >
    SELECT *, 'unknown' AS source
```

It is a `SELECT` list only, no `FROM`/`WHERE`, and it applies to existing data
until the next deploy compacts it. Remove it once the change is live.

## Self-hosting

**Tinybird is optional.** Openstatus runs without it; you lose the charts and
the time-series views. Set `TINYBIRD_NOOP=true` and every pipe and ingest call
resolves to empty instead of hitting the network.

To run it for real, you have two options.

### Tinybird Local

`docker compose up` starts a `tinybird-local` container (port `7181`) alongside
the rest of the stack. It comes up empty — the datafiles still need deploying:

```bash
cd packages/tinybird
tb --local deploy
```

Then point the apps at it:

```bash
TINYBIRD_URL=http://localhost:7181
TINY_BIRD_API_KEY=<token>          # tb --local token ls, then tb --local token copy <id>
```

### Tinybird Cloud

Create a workspace, deploy the datafiles with the commands above, and set
`TINY_BIRD_API_KEY` to a token with read access to the endpoints.
`TINYBIRD_URL` can stay empty — it defaults to `https://api.tinybird.co`.

## Gotcha: do not add a `tinybird.config.json` here

There was one; it has been removed on purpose. The CLI classifies a project by
scanning the paths named in that config's `folder`/`include` for source-file
extensions. With `"folder": "."` the scan covers this whole package, finds the
`.ts` files in `src/` and `scripts/`, decides it is a TypeScript-SDK project,
and then fails on every command — including `tb --help`:

```
Error: Failed to generate Tinybird resources from TypeScript definitions.
Unable to load Tinybird SDK generator bridge. Cannot find package '@tinybirdco/sdk'
```

`include` only adds scan targets, so there is no way to narrow it. Without the
config, the CLI falls back to detecting `datasources/` and friends and treats
this as a plain datafiles project, which is what we want.

If you ever do need a config here — for `dev_mode`, say — move the datafile
folders into a subdirectory with no `.ts` beside them and point `folder` at
that.
