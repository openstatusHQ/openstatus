# @openstatus/importers

Migrate monitors, status pages, components, incidents, and subscribers from third-party platforms into OpenStatus.

## Supported Providers

| Provider | What it imports | Auth |
|----------|----------------|------|
| **Atlassian Statuspage** | Status pages, components, component groups, incidents (as status reports), scheduled maintenances, email subscribers | OAuth API key |
| **Better Stack Uptime** | Monitors (HTTP checks), status pages, monitor groups, status page sections, incidents (as status reports) | Bearer API token |

## Architecture

```
packages/importers/
  src/
    types.ts                          # Shared types (ImportProvider, ImportSummary, etc.)
    index.ts                          # Provider registry + re-exports
    providers/
      statuspage/                     # Atlassian Statuspage provider
        api-types.ts                  #   Zod schemas for Statuspage API responses
        client.ts                     #   HTTP client (OAuth auth, page-based pagination)
        mapper.ts                     #   Statuspage -> OpenStatus data transformations
        provider.ts                   #   Import orchestration (validate + multi-phase run)
        fixtures.ts                   #   Mock data for tests
        index.ts                      #   Barrel exports
        *.test.ts                     #   Tests (client, mapper, provider)
      betterstack/                    # Better Stack Uptime provider
        api-types.ts                  #   Zod schemas for BetterStack API responses
        client.ts                     #   HTTP client (Bearer auth, JSON:API pagination)
        mapper.ts                     #   BetterStack -> OpenStatus data transformations
        provider.ts                   #   Import orchestration (validate + multi-phase run)
        fixtures.ts                   #   Mock data for tests
        index.ts                      #   Barrel exports
        *.test.ts                     #   Tests (client, mapper, provider)
```

## Core Types

Every provider implements `ImportProvider<TConfig>`:

```typescript
type ImportProvider<TConfig extends ImportConfig> = {
  name: string;
  validate: (config: TConfig) => Promise<{ valid: boolean; error?: string }>;
  run: (config: TConfig) => Promise<ImportSummary>;
};
```

A `run()` call returns an `ImportSummary` containing sequential `PhaseResult` entries. Each phase (e.g. `"monitors"`, `"page"`, `"components"`, `"incidents"`) contains an array of `ResourceResult` items with a `status` of `"created"`, `"skipped"`, or `"failed"` and an opaque `data` payload that the service layer writes to the database.

The importers package is **read-only** -- it fetches data from external APIs and maps it into OpenStatus shapes. The actual database writes happen in `packages/api/src/service/import.ts`.

## How the Import Pipeline Works

```
Dashboard UI (form-import.tsx)
  |
  | tRPC mutation: import.preview / import.run
  v
API Router (packages/api/src/router/import.ts)
  |
  | Calls previewImport() or runImport()
  v
Service Layer (packages/api/src/service/import.ts)
  |
  | 1. Creates provider via createProvider(name)
  | 2. Validates API key via provider.validate()
  | 3. Fetches + maps all data via provider.run()
  | 4. Checks plan limits (monitors, components, custom domain, subscribers)
  | 5. Writes to DB phase-by-phase with idempotency checks
  v
Importers Package (this package)
  |
  | provider.run() orchestrates:
  |   - API client fetches resources (with pagination)
  |   - Mapper transforms external -> OpenStatus shapes
  |   - Returns ImportSummary with all phases
  v
External API (Statuspage / BetterStack / ...)
```

## Import Phases by Provider

### Statuspage

| Phase | Source | Target |
|-------|--------|--------|
| `page` | Statuspage Page | `page` table |
| `componentGroups` | Component Groups | `pageComponentGroup` table |
| `components` | Components | `pageComponent` table (type: `"static"`) |
| `incidents` | Real-time Incidents | `statusReport` + `statusReportUpdate` tables |
| `maintenances` | Scheduled Incidents | `maintenance` table |
| `subscribers` | Email Subscribers | `pageSubscriber` table |

### BetterStack

| Phase | Source | Target |
|-------|--------|--------|
| `monitors` | Monitors | `monitor` table |
| `page` | Status Page (first or filtered by ID) | `page` table |
| `sections` | Status Page Sections (only if status page exists) | `pageComponentGroup` table |
| `monitorGroups` | Monitor Groups | `pageComponentGroup` table |
| `incidents` | Incidents (with synthetic updates from timestamps) | `statusReport` + `statusReportUpdate` tables |

## Adding a New Provider

Each provider follows the same 6-file pattern. Here is how to add one:

### 1. Create the provider directory

```
packages/importers/src/providers/<name>/
```

### 2. Define API types (`api-types.ts`)

Use Zod schemas matching the external API's response format. Export both the schema and the inferred TypeScript type:

```typescript
import { z } from "zod";

export const MyResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ...
});

export type MyResource = z.infer<typeof MyResourceSchema>;
```

### 3. Build the API client (`client.ts`)

- Define a `Client` type with methods for each endpoint
- Handle authentication (Bearer, OAuth, API key header, etc.)
- Implement pagination (page-based, cursor-based, JSON:API, etc.)
- Parse all responses through Zod schemas for runtime safety

```typescript
export type MyClient = {
  getResources: () => Promise<MyResource[]>;
};

export function createMyClient(apiKey: string): MyClient {
  // ...
}
```

### 4. Write mappers (`mapper.ts`)

Pure functions that transform external API shapes into OpenStatus insert values. Each mapper takes the source object + `workspaceId` (and optionally `pageId`) and returns a plain object:

```typescript
export function mapResource(resource: MyResource, workspaceId: number) {
  return {
    workspaceId,
    name: resource.name,
    // ...
  };
}
```

### 5. Create the provider (`provider.ts`)

Implement `ImportProvider<TConfig>`:

- `validate()` -- make a lightweight API call to verify the key works
- `run()` -- fetch all resources, map them, return `ImportSummary` with phases

Each phase produces `ResourceResult[]` with the mapped data in `data`. The service layer reads `data` to write to the database.

The `data` shape must match what the corresponding phase writer in `packages/api/src/service/import.ts` casts it to. For incidents, this means the mapper must return `{ report, updates, sourceComponentIds }` -- even if `sourceComponentIds` is empty.

### 6. Register the provider

1. Create `index.ts` with barrel exports
2. Add to `IMPORT_PROVIDERS` in `src/index.ts`
3. Add export paths in `package.json`
4. Add a case in `createProvider()` in `packages/api/src/service/import.ts`
5. Add the provider name to the `z.enum` in `packages/api/src/router/import.ts`
6. Add a radio button in `apps/dashboard/src/components/forms/components/form-import.tsx`

### 7. Write tests

Follow the existing pattern:

- **`client.test.ts`** -- mock `globalThis.fetch`, test each endpoint, auth headers, pagination, and error handling
- **`mapper.test.ts`** -- test every mapping function with edge cases (nulls, unknown values, empty arrays)
- **`provider.test.ts`** -- mock all endpoints, verify phase structure, resource counts, and filtering
- **`fixtures.ts`** -- realistic mock data used by all three test files

## Key Design Decisions

- **Zod for API validation**: All external API responses are parsed through Zod schemas. This catches API changes at runtime rather than letting bad data silently propagate.
- **Idempotent writes**: The service layer checks for existing resources before inserting (by slug, name+pageId, url+workspaceId, etc.). Re-running an import skips already-imported resources.
- **Phase-based execution**: Imports run sequentially by phase so that ID mappings from earlier phases (e.g. group IDs) are available to later phases (e.g. components). If a phase fails, subsequent phases are skipped.
- **Dry-run support**: Setting `dryRun: true` in the config still fetches and maps all data but the service layer skips database writes. This powers the preview UI.
- **Plan limit enforcement**: The service layer checks workspace plan limits (max monitors, max components, custom domain support, subscriber support) and either warns (preview) or truncates (run).

## Running Tests

```sh
cd packages/importers
bun test
```

## Package Exports

| Path | Description |
|------|-------------|
| `@openstatus/importers` | Main entry: types, provider registry, factory functions |
| `@openstatus/importers/types` | Just the shared types |
| `@openstatus/importers/statuspage` | Statuspage provider, client, schemas, types |
| `@openstatus/importers/statuspage/fixtures` | Statuspage mock data for tests |
| `@openstatus/importers/betterstack` | BetterStack provider, client, schemas, types |
| `@openstatus/importers/betterstack/fixtures` | BetterStack mock data for tests |
