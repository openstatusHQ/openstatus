# MCP Registry listing

The hosted MCP server (`https://api.openstatus.dev/mcp`) is listed in the
official MCP Registry (https://registry.modelcontextprotocol.io) under the
name `dev.openstatus/mcp`. The registry stores metadata only; it
never fetches `server.json` over HTTP and does not change how the server
runs. Listing exists for discoverability in MCP clients.

## Files

- `apps/server/server.json` — the listing. Read from disk by `mcp-publisher`
  and POSTed to the registry. Does not need to be routed or served.
- `~/.config/openstatus/mcp-registry/` (local machine, **not** in git):
  - `openstatus.dev.ed25519.pem` — private key proving ownership of the
    `dev.openstatus/*` namespace. Backed up in the password manager.
  - `openstatus.dev.txt-record` — the public TXT record value.
  - `login.sh` — runs `mcp-publisher login dns` with the stored key.

## Namespace ownership

`dev.openstatus/*` is the reverse-DNS namespace for `openstatus.dev`.
Ownership is proven by a TXT record on the **apex** `openstatus.dev` in
Vercel DNS (name `@`, not a selector subdomain):

```
v=MCPv1; k=ed25519; p=<base64 public key>
```

The matching private key never leaves the local config dir or a CI secret.
If the key is lost or rotated: generate a new one, replace the TXT record,
and delete the old record (a stale record is tried first and fails login).

## Publishing a new version

Every publish is immutable. Bump `version` in `server.json` first.

```bash
~/.config/openstatus/mcp-registry/login.sh   # DNS auth, token cached locally
cd apps/server
mcp-publisher validate                        # checks against the live registry
mcp-publisher publish
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=dev.openstatus"
```

Constraints hit so far: `description` is capped at 100 characters.

## Setup log

- 2026-09-10: installed `mcp-publisher` 1.8.1 (`/opt/homebrew/bin`),
  generated the Ed25519 key, wrote and validated `server.json`.
  Pending at time of writing: TXT record in Vercel DNS, first login, first
  publish. Not automated in CI yet; the GitHub Actions template in the
  registry docs works with `login dns` and the private key hex as a secret.

## References

- https://github.com/modelcontextprotocol/registry/tree/main/docs/modelcontextprotocol-io
  (`quickstart`, `remote-servers`, `authentication`, `github-actions`)
