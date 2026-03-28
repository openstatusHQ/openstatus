# Database Scripts

## sync-replica

Syncs a read-only replica of the production database to `~/.openstatus/replica.db` for use with Claude Code via the Turso MCP server.

### What it does

1. Pulls a snapshot from the remote Turso database to a local SQLite file
2. Scrubs sensitive tables
3. Outputs the path for MCP registration

The sync is **one-way** — local changes are never pushed back to prod.

### Prerequisites

Install the latest Turso CLI:

```sh
curl -sSL tur.so/install | sh
```

### Usage

```sh
# Set credentials
export DATABASE_URL="libsql://..."
export DATABASE_AUTH_TOKEN="..."

# Sync
cd packages/db
pnpm sync-replica
```

### Connecting to Claude Code

After syncing, register the MCP server:

```sh
claude mcp add turso -- tursodb ~/.openstatus/replica.db --mcp
```

Then restart Claude Code. Re-run `pnpm sync-replica` whenever you need fresher data.
