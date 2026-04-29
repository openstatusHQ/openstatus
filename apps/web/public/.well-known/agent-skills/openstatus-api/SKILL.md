---
name: openstatus-api
description: Call the openstatus public API (ConnectRPC, JSON over HTTP) to manage monitors, status pages, status reports, and maintenance windows. Use when building integrations, automating monitoring as code, or driving openstatus from a script outside an MCP client.
---

# openstatus API

The openstatus API is a typed, JSON-over-HTTP layer powered by ConnectRPC. The base URL is `https://api.openstatus.dev`. Every action the dashboard performs is reachable from the API — same workspace, same audit log, same single API key.

## Auth

Send the API key as the `x-openstatus-key` header. Generate one in **Settings → API Tokens**.

```
x-openstatus-key: os_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Example: list monitors

```bash
curl https://api.openstatus.dev/rpc/openstatus.v1.MonitorService/ListMonitors \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-openstatus-key: $OPENSTATUS_API_KEY" \
  -d '{}'
```

ConnectRPC accepts both JSON and protobuf. POST is required even for read operations.

## Schema

- OpenAPI explorer (machine-readable description): <https://api.openstatus.dev/openapi>
- Reference docs: <https://docs.openstatus.dev>

## SDKs

- Node SDK: <https://jsr.io/@openstatus/sdk-node>
- Terraform provider: see <https://www.openstatus.dev/tooling>

## When to use this vs MCP

- API → programmatic integrations, CI/CD, scripts.
- MCP server (`openstatus-mcp` skill) → chat-shaped AI clients that need to read and update status pages.
