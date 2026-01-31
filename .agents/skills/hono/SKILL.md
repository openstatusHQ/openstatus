---
name: hono
description: Efficiently develop Hono applications using Hono CLI. Supports documentation search, API reference lookup, request testing, and bundle optimization.
---

# Hono Skill

Develop Hono applications efficiently using Hono CLI (`@hono/cli`).

## Setup

You can use Hono CLI without global installation via npx:

```bash
npx @hono/cli <command>
```

Or install globally (optional):

```bash
npm install -g @hono/cli
```

## Commands for AI

### 1. Search Documentation

```bash
hono search "<query>" --pretty
```

Search for Hono APIs and features. Use `--pretty` for human-readable output.

### 2. View Documentation

```bash
hono docs [path]
```

Display detailed documentation for a specific path found in search results.

**Examples:**

```bash
hono docs /docs/api/context
hono docs /docs/api/hono
hono docs /docs/helpers/factory
```

### 3. Request Testing

```bash
# GET request
hono request [file] -P /path

# POST request
hono request [file] -X POST -P /api/users -d '{"name": "test"}'

# Request with headers
hono request [file] -H "Authorization: Bearer token" -P /api/protected
```

Uses `app.request()` internally, so no server startup required for testing.

### 4. Optimization & Bundling

```bash
# Bundle optimization
hono optimize [entry] -o dist/index.js

# With minification
hono optimize [entry] -o dist/index.js --minify

# Specify target (cloudflare-workers, deno, etc.)
hono optimize [entry] -t cloudflare-workers
```

## Development Workflow

1. **Research**: Use `hono search` → `hono docs` to investigate APIs and features
2. **Implement**: Write the code
3. **Test**: Use `hono request` to test endpoints
4. **Optimize**: Use `hono optimize` for production builds when needed

## Guidelines

- Always search with `hono search` before implementing unfamiliar APIs
- Use `--pretty` flag with `hono search` (default output is JSON)
- `hono request` works without starting an HTTP server
- Search for middleware usage with `hono search "middleware name"`
