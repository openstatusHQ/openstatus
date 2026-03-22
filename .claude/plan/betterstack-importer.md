# Implementation Plan: BetterStack Uptime Importer

## Task Type
- [x] Backend
- [x] Frontend (minor UI additions)

## Overview

Add a BetterStack Uptime provider to the `@openstatus/importers` package, enabling users to migrate their monitors, status pages, components, and incidents from BetterStack to OpenStatus.

### Key Difference from Statuspage Importer

BetterStack is a **monitoring platform** (like OpenStatus), not just a status page tool. This means:
- BetterStack has **monitors** (HTTP checks with URLs, frequency, regions) — these map directly to OpenStatus monitors
- BetterStack has **status pages** with **sections** that link monitors to pages
- BetterStack has **monitor groups** — these can map to component groups
- BetterStack **incidents** are auto-generated from monitor failures — these map to status reports

This is the **first importer that can import actual monitors**, not just status page data.

---

## Technical Solution

### BetterStack API Summary

| Resource | Endpoint | Version |
|----------|----------|---------|
| Monitors | `GET /api/v2/monitors` | v2 |
| Monitor Groups | `GET /api/v2/monitor-groups` | v2 |
| Status Pages | `GET /api/v2/status-pages` | v2 |
| Status Page Sections | `GET /api/v2/status-pages/{id}/sections` | v2 |
| Incidents | `GET /api/v3/incidents` | v3 |

- **Auth**: `Authorization: Bearer $TOKEN`
- **Pagination**: JSON:API style — `?page=N`, response includes `pagination.next` link
- **Base URL**: `https://uptime.betterstack.com`

### BetterStack → OpenStatus Field Mapping

#### Monitors (NEW phase)

| BetterStack | OpenStatus | Notes |
|-------------|------------|-------|
| `url` | `url` | Direct mapping |
| `pronounceable_name` | `name` | |
| `monitor_type` | `jobType` | Map: "status"/"keyword"/"expected_status_code" → "http", "tcp" → "tcp" |
| `http_method` | `method` | Map to uppercase: "get" → "GET" |
| `check_frequency` | `periodicity` | Map seconds: 30→"30s", 60→"1m", 180→"3m", 300→"5m", 600→"10m", 1800→"30m" etc. |
| `request_timeout` | `timeout` | Seconds → milliseconds |
| `request_headers` | `headers` | Array of {name,value} → JSON string |
| `request_body` | `body` | Direct mapping |
| `expected_status_codes` | `assertions` | Map to assertions format |
| `required_keyword` | `assertions` | Map to body contains assertion |
| `regions` | `regions` | Map: ["us","eu","as","au"] → OpenStatus region codes |
| `verify_ssl` | — | No direct equivalent |
| `status` | `status`/`active` | "paused" → active:false, "up"/"down" → active:true |

#### Status Pages

| BetterStack | OpenStatus | Notes |
|-------------|------------|-------|
| `company_name` | `title` | |
| `subdomain` | `slug` | |
| `custom_domain` | `customDomain` | |
| `timezone` | — | Stored as metadata if needed |

#### Status Page Sections → Component Groups + Components

BetterStack sections contain monitors. Each section maps to a **component group**, and each monitor within a section maps to a **component** (with `type: "monitor"` and linked `monitorId`).

#### Incidents → Status Reports

| BetterStack | OpenStatus | Notes |
|-------------|------------|-------|
| `name` | `title` | |
| `started_at` | First update date | |
| `acknowledged_at` | Update with status "identified" | |
| `resolved_at` | Update with status "resolved" | |
| `cause` | Update message body | |
| `status` (started/acknowledged/resolved) | Map to investigating/identified/resolved | |

---

## Implementation Steps

### Step 1: Create BetterStack API Types (`packages/importers/src/providers/betterstack/api-types.ts`)

Define Zod schemas for all BetterStack API responses:

```typescript
// BetterstackMonitor schema
const BetterstackMonitorSchema = z.object({
  id: z.string(),
  type: z.literal("monitor"),
  attributes: z.object({
    url: z.string(),
    pronounceable_name: z.string(),
    monitor_type: z.string(),
    monitor_group_id: z.string().nullable(),
    http_method: z.string().default("get"),
    check_frequency: z.number(),
    request_timeout: z.number(),
    request_headers: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      value: z.string(),
    })).default([]),
    request_body: z.string().default(""),
    expected_status_codes: z.array(z.number()).default([]),
    required_keyword: z.string().nullable().default(null),
    verify_ssl: z.boolean().default(true),
    regions: z.array(z.string()).default([]),
    status: z.string(), // "up", "down", "paused", "pending", "maintenance", "validating"
    paused_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

// BetterstackMonitorGroup schema
const BetterstackMonitorGroupSchema = z.object({
  id: z.string(),
  type: z.literal("monitor_group"),
  attributes: z.object({
    name: z.string(),
    sort_index: z.number().nullable(),
    paused: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

// BetterstackStatusPage schema
const BetterstackStatusPageSchema = z.object({
  id: z.string(),
  type: z.literal("status_page"),
  attributes: z.object({
    company_name: z.string(),
    company_url: z.string().nullable(),
    subdomain: z.string(),
    custom_domain: z.string().nullable(),
    timezone: z.string().nullable(),
    subscribable: z.boolean().default(false),
    aggregate_state: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

// BetterstackStatusPageSection schema
const BetterstackStatusPageSectionSchema = z.object({
  id: z.string(),
  type: z.literal("status_page_section"),
  attributes: z.object({
    name: z.string(),
    position: z.number(),
    status_page_id: z.number(),
  }),
});

// BetterstackIncident schema (v3)
const BetterstackIncidentSchema = z.object({
  id: z.string(),
  type: z.literal("incident"),
  attributes: z.object({
    name: z.string().nullable(),
    url: z.string().nullable(),
    cause: z.string().nullable(),
    started_at: z.string(),
    acknowledged_at: z.string().nullable(),
    resolved_at: z.string().nullable(),
    status: z.string(), // "started", "acknowledged", "resolved"
    regions: z.array(z.string()).default([]),
  }),
});

// JSON:API paginated response wrapper
const PaginatedResponseSchema = <T>(dataSchema: z.ZodType<T>) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      first: z.string().nullable(),
      last: z.string().nullable(),
      prev: z.string().nullable(),
      next: z.string().nullable(),
    }),
  });
```

**Expected deliverable**: Complete Zod schemas validated against BetterStack API docs.

### Step 2: Create BetterStack API Client (`packages/importers/src/providers/betterstack/client.ts`)

```typescript
export type BetterstackClient = {
  getMonitors: () => Promise<BetterstackMonitor[]>;
  getMonitorGroups: () => Promise<BetterstackMonitorGroup[]>;
  getStatusPages: () => Promise<BetterstackStatusPage[]>;
  getStatusPageSections: (statusPageId: string) => Promise<BetterstackStatusPageSection[]>;
  getIncidents: () => Promise<BetterstackIncident[]>;
};

export function createBetterstackClient(
  apiKey: string,
  baseUrl = "https://uptime.betterstack.com",
): BetterstackClient {
  // Implement JSON:API pagination (follow `pagination.next` links)
  // Use Bearer token auth
  // Use Zod for runtime validation
}
```

Key differences from Statuspage client:
- **Auth**: Bearer token (not OAuth)
- **Pagination**: JSON:API style — follow `pagination.next` URL until null
- **Response format**: Nested under `data[].attributes` (JSON:API envelope)
- **Two base URLs**: v2 for monitors/status-pages, v3 for incidents

**Expected deliverable**: Working API client with pagination and Zod validation.

### Step 3: Create Mapper (`packages/importers/src/providers/betterstack/mapper.ts`)

Functions to implement:

```typescript
// Map BetterStack monitor → OpenStatus monitor insert data
export function mapMonitor(monitor: BetterstackMonitor, workspaceId: number): { ... }

// Map BetterStack monitor group → OpenStatus component group
export function mapMonitorGroup(group: BetterstackMonitorGroup, workspaceId: number, pageId?: number): { ... }

// Map BetterStack status page → OpenStatus page
export function mapStatusPage(page: BetterstackStatusPage, workspaceId: number): { ... }

// Map BetterStack section → OpenStatus component group
export function mapSection(section: BetterstackStatusPageSection, workspaceId: number, pageId?: number): { ... }

// Map BetterStack incident → OpenStatus status report with updates
export function mapIncidentToStatusReport(incident: BetterstackIncident, workspaceId: number, pageId?: number): { ... }

// Map BetterStack check_frequency (seconds) → OpenStatus periodicity enum
export function mapFrequency(seconds: number): string

// Map BetterStack regions → OpenStatus region codes
export function mapRegions(regions: string[]): string

// Map BetterStack monitor_type → OpenStatus jobType
export function mapMonitorType(type: string): string
```

**Mapping details for `mapFrequency`:**
```
30 → "30s"
60 → "1m"
120 → "1m" (closest)
180 → "3m" (closest, snap to nearest supported)
300 → "5m"
600 → "10m"
1800 → "30m"
3600 → "1h"
default → "10m" (safe default)
```

**Mapping details for `mapRegions`:**
BetterStack uses broad regions: `["us", "eu", "as", "au"]`
OpenStatus uses specific regions like `"iad"`, `"fra"`, `"sin"`, `"syd"` etc.
Map: `us→"iad"`, `eu→"fra"`, `as→"sin"`, `au→"syd"` (pick one representative per broad region, comma-joined).

**Mapping for incident status:**
```
started → investigating
acknowledged → identified
resolved → resolved
```

**Expected deliverable**: Complete mapper with all transformation functions.

### Step 4: Create Provider (`packages/importers/src/providers/betterstack/provider.ts`)

```typescript
export interface BetterstackImportConfig extends ImportConfig {
  betterstackStatusPageId?: string; // Optional: import specific status page
  includeMonitors?: boolean;        // Whether to import monitors (default: true)
}

export function createBetterstackProvider(): ImportProvider<BetterstackImportConfig> {
  return {
    name: "betterstack",
    validate: async (config) => { /* test API key with getMonitors() */ },
    run: async (config) => {
      // Phase order:
      // 1. "monitors" — fetch and map all monitors (NEW)
      // 2. "page" — create/map status page
      // 3. "monitorGroups" — create component groups from monitor groups
      // 4. "components" — create components from status page sections, link to monitors
      // 5. "incidents" — map incidents to status reports
    },
  };
}
```

**Phase details:**

1. **monitors phase** (NEW — doesn't exist in statuspage importer):
   - Fetch all monitors from BetterStack
   - Map each to OpenStatus monitor format
   - Return as ResourceResult with `data` containing monitor insert values
   - Track sourceId → name for component linking later

2. **page phase**: Same pattern as statuspage

3. **monitorGroups phase**: Map monitor groups to component groups

4. **components phase**:
   - If a status page is selected, fetch its sections
   - Each section becomes a component group
   - Monitors linked to sections become components with `type: "monitor"` and `monitorId` set
   - Monitors NOT in any section become standalone components

5. **incidents phase**:
   - Fetch incidents (optionally filtered by monitor_id)
   - Map each to a status report with synthetic updates based on timestamps
   - Each incident generates 1-3 updates: started→investigating, acknowledged→identified, resolved→resolved

**Expected deliverable**: Complete provider with multi-phase import orchestration.

### Step 5: Create Provider Index + Fixtures (`packages/importers/src/providers/betterstack/index.ts`, `fixtures.ts`)

- Re-export provider and config type from `index.ts`
- Create comprehensive fixtures in `fixtures.ts` for testing

**Expected deliverable**: Clean exports and test fixtures.

### Step 6: Register Provider in Package (`packages/importers/src/index.ts`, `package.json`)

Update `packages/importers/src/index.ts`:
```typescript
export { createBetterstackProvider } from "./providers/betterstack";
export type { BetterstackImportConfig } from "./providers/betterstack";

export const IMPORT_PROVIDERS = ["statuspage", "betterstack"] as const;
```

Update `packages/importers/package.json` exports:
```json
"./betterstack": { "types": "./src/providers/betterstack/index.ts", "default": "./src/providers/betterstack/index.ts" },
"./betterstack/fixtures": { "types": "./src/providers/betterstack/fixtures.ts", "default": "./src/providers/betterstack/fixtures.ts" }
```

**Expected deliverable**: Package properly exports new provider.

### Step 7: Update Service Layer (`packages/api/src/service/import.ts`)

Add BetterStack provider handling:
- Import `createBetterstackProvider`
- Add a **new `writeMonitorsPhase`** function that inserts monitors into the `monitor` table
  - Idempotency: check by `url + workspaceId`
  - Track `sourceId → openstatusId` in `monitorIdMap`
- Update `writeComponentsPhase` to handle `type: "monitor"` components with resolved `monitorId`
- Add monitor count limit check in `addLimitWarnings` (check workspace plan's monitor limit)
- Make `previewImport` and `runImport` provider-aware (accept provider name, instantiate correct provider)

```typescript
// New function
async function writeMonitorsPhase(
  phase: PhaseResult,
  workspaceId: number,
  monitorIdMap: Map<string, number>,
  limits: Limits,
): Promise<void> {
  const maxMonitors = limits["monitors"]; // check plan limit
  // ... insert monitors with idempotency by url+workspaceId
}
```

**Expected deliverable**: Service layer handles both providers, with new monitor writing capability.

### Step 8: Update tRPC Router (`packages/api/src/router/import.ts`)

```typescript
// Update input schema
provider: z.enum(["statuspage", "betterstack"]),

// Add betterstack-specific fields
betterstackStatusPageId: z.string().nullish(),
includeMonitors: z.boolean().default(true),

// Route to correct provider in preview/run
```

**Expected deliverable**: API endpoints accept betterstack as provider.

### Step 9: Update Dashboard Form (`apps/dashboard/src/components/forms/components/form-import.tsx`)

- Add BetterStack to the provider radio group (needs a BetterStack icon)
- Show BetterStack-specific fields when selected:
  - API Token input (with description: "Found in Better Stack → API tokens")
  - Optional Status Page ID
- Add "Monitors" toggle switch in preview (new toggle for `includeMonitors`)
- Add "monitors" to `PHASE_LABELS` map
- Update form schema to accept `"betterstack"` provider

```typescript
const schema = z.object({
  provider: z.enum(["statuspage", "betterstack"]),
  apiKey: z.string().min(1),
  statuspagePageId: z.string().optional(),     // statuspage only
  betterstackStatusPageId: z.string().optional(), // betterstack only
  includeMonitors: z.boolean(),                  // betterstack only
  includeStatusReports: z.boolean(),
  includeSubscribers: z.boolean(),
  includeComponents: z.boolean(),
});
```

**Expected deliverable**: Dashboard UI supports BetterStack provider selection and configuration.

### Step 10: Write Tests

Following the existing test patterns:

1. **`client.test.ts`**: Mock HTTP responses, test pagination, error handling, Zod validation
2. **`mapper.test.ts`**: Test all mapping functions with edge cases (null fields, unknown regions, unmapped frequencies)
3. **`provider.test.ts`**: End-to-end provider flow with mock client, verify phase structure and resource counts

**Expected deliverable**: Comprehensive test coverage matching statuspage test quality.

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/importers/src/providers/betterstack/api-types.ts` | **Create** | Zod schemas for BetterStack API |
| `packages/importers/src/providers/betterstack/client.ts` | **Create** | API client with JSON:API pagination |
| `packages/importers/src/providers/betterstack/mapper.ts` | **Create** | Data transformation functions |
| `packages/importers/src/providers/betterstack/provider.ts` | **Create** | Import orchestration with monitor phase |
| `packages/importers/src/providers/betterstack/index.ts` | **Create** | Provider exports |
| `packages/importers/src/providers/betterstack/fixtures.ts` | **Create** | Test fixtures |
| `packages/importers/src/providers/betterstack/client.test.ts` | **Create** | Client tests |
| `packages/importers/src/providers/betterstack/mapper.test.ts` | **Create** | Mapper tests |
| `packages/importers/src/providers/betterstack/provider.test.ts` | **Create** | Provider tests |
| `packages/importers/src/index.ts` | **Modify** | Register betterstack provider |
| `packages/importers/package.json` | **Modify** | Add betterstack export paths |
| `packages/api/src/service/import.ts` | **Modify** | Add monitor writing, provider routing |
| `packages/api/src/router/import.ts` | **Modify** | Accept betterstack provider + fields |
| `apps/dashboard/src/components/forms/components/form-import.tsx` | **Modify** | Add BetterStack UI |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| BetterStack API response format may differ from docs | Use Zod `.passthrough()` on optional fields; test with real API key before merging |
| Region mapping may be incomplete | Use conservative defaults; log unmapped regions as warnings |
| Frequency mapping — BetterStack may use values not in OpenStatus's periodicity enum | Snap to nearest supported value with a warning |
| Incidents API is v3 while monitors are v2 — different base paths | Client handles both versions internally |
| Monitor import is new — no existing DB write pattern | Follow component write pattern but for `monitor` table; add idempotency by URL |
| Status page sections API might not expose which monitors are in each section | Fallback: create all monitors as standalone components; sections become empty groups |
| BetterStack API rate limits | Add retry-after header handling in client |
| BetterStack icon not available in `@openstatus/icons` | Need to add BetterStack SVG icon or use a generic icon |

---

## Out of Scope (for future PRs)

- Importing heartbeats (BetterStack cron/heartbeat monitors)
- Importing on-call schedules and escalation policies
- Importing notification channels (integrations)
- Importing status page subscribers (BetterStack subscriber API not explored yet)
- Bidirectional sync
