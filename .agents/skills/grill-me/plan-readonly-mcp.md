# Read-Only Turso MCP for Claude

## Goal

Connect Claude to a read-only replica of the prod database via Turso MCP, so Claude can answer product analytics and debugging questions without any risk to prod.

## Architecture

```
Prod Turso DB  →  (one-shot sync)  →  ~/.openstatus/replica.db  →  Turso MCP  →  Claude
                                       (chmod 444, scrubbed)        (execute_query only)
```

## Steps

### 1. Sync script — `packages/db/src/sync-replica.mts`

- Loads `DATABASE_URL` + `DATABASE_AUTH_TOKEN` from `packages/db/.env`
- Creates `~/.openstatus/` directory if needed
- Uses `@libsql/client` embedded replica: `file:///Users/<user>/.openstatus/replica.db` with `syncUrl` pointing to prod
- Calls `.sync()` once, then:
  - Scrubs sensitive tables: `DELETE FROM apiKey; DELETE FROM session;`
  - Sets file permissions to `chmod 444` (read-only)
- Exits

### 2. Package.json script

- Add `"sync-replica"` to `packages/db/package.json` so it can be run with `pnpm sync-replica`

### 3. MCP registration

```bash
claude mcp add turso --tool execute_query -- turso mcp ~/.openstatus/replica.db
```

- `--tool execute_query` restricts Claude to read-only SELECT queries only
- Exact `turso mcp` args to be confirmed via `turso mcp --help`

### 4. Gitignore

- Ensure `replica.db` is not committable (should already be covered by `*.db` patterns, verify)

## Usage

1. Run `cd packages/db && pnpm sync-replica` to get a fresh snapshot
2. Claude can now query the replica via the MCP tool
3. Re-run the sync script whenever you need fresher data

## Safety layers

1. **Network isolation** — local `.db` file, no network path back to prod
2. **Tool filtering** — Claude only sees `execute_query` (SELECT-only), not insert/update/delete/schema tools
3. **File permissions** — `chmod 444` prevents writes at the OS level
4. **Credential scrub** — `apiKey` and `session` tables are deleted after sync
