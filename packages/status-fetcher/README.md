# @openstatus/status-fetcher

A production-ready, type-safe library for fetching real-time status from major tech companies and service providers, with support for 6 status page platforms.

## Features

- 📋 **Curated Registry** - TypeScript-based list of verified status pages with runtime validation
- 🔌 **6 Provider Fetchers** - Support for Atlassian, Instatus, BetterStack, Incident.io, Custom APIs, and HTML scraping
- ✅ **Type-safe** - Full TypeScript support with Zod runtime validation
- 🔄 **Automatic Retries** - Exponential backoff retry logic for transient failures
- ⏱️ **Smart Timeouts** - Configurable 30s timeout prevents hanging requests
- 🎯 **Minimal Dependencies** - Only requires `zod` and `node-html-parser`
- 🛡️ **Production Ready** - Comprehensive error handling and context-rich error messages

## Quick Start

```typescript
import { getStatusDirectory } from "@openstatus/status-fetcher";
import { fetchers } from "@openstatus/status-fetcher/fetchers";

const directory = getStatusDirectory();
const github = directory.find((e) => e.id === "github");

if (github) {
  const fetcher = fetchers.find((f) => f.canHandle(github));
  if (fetcher) {
    const status = await fetcher.fetch(github);
    console.log(`${github.name}: ${status.status} - ${status.description}`);
    // Output: GitHub: operational - All Systems Operational
  }
}
```

## Usage

### Get Directory Entries

```typescript
import { getStatusDirectory } from "@openstatus/status-fetcher";

const directory = getStatusDirectory();
console.log(`Found ${directory.length} status pages`);

// Filter by industry
const saasCompanies = directory.filter((e) =>
  e.industry.includes("saas"),
);

// Filter by provider
const atlassianPages = directory.filter((e) =>
  e.provider === "atlassian-statuspage",
);
```

### Fetch Status with Error Handling

```typescript
import { getStatusDirectory } from "@openstatus/status-fetcher";
import { fetchers, FetchError } from "@openstatus/status-fetcher/fetchers";

const directory = getStatusDirectory();

for (const entry of directory) {
  const fetcher = fetchers.find((f) => f.canHandle(entry));
  if (!fetcher) {
    console.log(`No fetcher for ${entry.name}`);
    continue;
  }

  try {
    const status = await fetcher.fetch(entry);
    console.log(
      `✅ ${entry.name}: ${status.status} (${status.severity}) - ${status.description}`,
    );
  } catch (error) {
    if (error instanceof FetchError) {
      console.error(
        `❌ ${error.entryId}: ${error.message}`,
      );
    } else {
      console.error(`Failed to fetch ${entry.name}:`, error);
    }
  }
}
```

### Using Fetch Utilities Directly

```typescript
import {
  fetchWithRetry,
  fetchWithTimeout,
  fetchWithDeduplication,
} from "@openstatus/status-fetcher";

// Fetch with automatic retry (3 attempts, exponential backoff)
const response = await fetchWithRetry("https://api.example.com/status", {
  timeout: 30000,
  maxRetries: 3,
  headers: { "User-Agent": "MyApp/1.0" },
});

// Fetch with timeout only
const response2 = await fetchWithTimeout("https://api.example.com/health", {
  timeout: 10000,
});

// Fetch with request deduplication (concurrent requests to same URL are deduplicated)
const [r1, r2, r3] = await Promise.all([
  fetchWithDeduplication("https://api.example.com/status"),
  fetchWithDeduplication("https://api.example.com/status"), // Reuses first request
  fetchWithDeduplication("https://api.example.com/status"), // Reuses first request
]);
```

## Supported Providers

| Provider | Coverage | Features | Authentication |
|----------|----------|----------|----------------|
| Atlassian Statuspage | ~60% of status pages | Full API support, rich metadata | None required |
| Instatus | Growing adoption | Real-time updates, maintenance windows | None required |
| BetterStack (Better Uptime) | Popular in startups | Aggregate state, timezone support | None required |
| Incident.io | Enterprise | Incident workflow states | None required |
| Custom APIs | Slack, etc. | Configurable parsers | None required |
| HTML Scraper | Universal fallback | Pattern-based extraction | None required |

## Architecture

### Type System

All types are derived from single-source-of-truth arrays:

```typescript
// Source of truth
export const STATUS_PAGE_PROVIDERS = [
  "atlassian-statuspage",
  "instatus",
  // ...
] as const;

// TypeScript type (automatically inferred)
export type StatusPageProvider = (typeof STATUS_PAGE_PROVIDERS)[number];

// Zod schema (automatically derived)
export const statusPageProviderSchema = z.enum(STATUS_PAGE_PROVIDERS);
```

This eliminates duplication and ensures TypeScript types and runtime validation are always in sync.

### Severity vs Status

The package provides two complementary fields:

- **Severity**: Impact level (`none`, `minor`, `major`, `critical`)
- **Status**: Actual state (`operational`, `degraded`, `investigating`, `major_outage`, etc.)

This allows for nuanced status reporting:

```typescript
{
  severity: "none",
  status: "under_maintenance"  // Scheduled, not impactful
}

{
  severity: "major",
  status: "investigating"  // Active incident being investigated
}
```

### Retry & Timeout Logic

All fetchers use intelligent retry logic:

- **Automatic retries**: 3 attempts with exponential backoff (100ms → 200ms → 400ms)
- **Smart retry**: Only retries network errors and 5xx responses, not 4xx client errors
- **Timeout**: 30s default timeout prevents hanging requests
- **Context-rich errors**: Errors include fetcher name, entry ID, and URL for debugging

```typescript
// Retry logic (simplified)
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    const response = await fetchWithTimeout(url, { timeout: 30000 });
    if (response.ok || response.status < 500) return response;
  } catch (error) {
    if (attempt < maxRetries && shouldRetry(error)) {
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
}
```

## Data Structures

### StatusPageEntry

```typescript
interface StatusPageEntry {
  id: string;                    // Unique slug (e.g., "github")
  name: string;                  // Display name
  url: string;                   // Main company website
  status_page_url: string;       // Status page URL
  provider: StatusPageProvider;  // Platform used
  industry: Industry[];          // Categorization (e.g., ["saas", "development-tools"])
  description?: string;          // Short description
  api_config?: ApiConfig;        // Fetcher configuration
}
```

### StatusResult

```typescript
interface StatusResult {
  severity: SeverityLevel;  // Impact: "none" | "minor" | "major" | "critical"
  status: StatusType;       // State: "operational" | "degraded" | "partial_outage" |
                            //        "major_outage" | "under_maintenance" | "investigating" |
                            //        "identified" | "monitoring" | "resolved"
  description: string;      // Human-readable status message
  updated_at: number;       // Timestamp (ms since epoch)
  timezone?: string;        // Timezone (e.g., "UTC", "America/New_York")
}
```

### ApiConfig

```typescript
interface ApiConfig {
  type: "atlassian" | "instatus" | "betterstack" | "incidentio" | "custom" | "html-scraper";
  endpoint?: string;  // Custom API endpoint (overrides default)
  parser?: string;    // Custom parser name (for custom type)
}
```

## Testing

Run the test suite:

```bash
bun test
# or
npm test
```

Test all fetchers manually:

```bash
tsx scripts/test-fetchers.ts
```

Example output:
```
🔍 Testing 7 entries...

✅ GitHub: operational (none) - All Systems Operational (245ms)
✅ Vercel: operational (none) - All Systems Operational (198ms)
✅ Slack: operational (none) - All Systems Operational (312ms)
✅ Linear: operational (none) - All Systems Operational (156ms)
✅ OpenAI: operational (none) - All Systems Operational (223ms)
✅ Stripe: operational (none) - All Systems Operational (189ms)
✅ Cloudflare: operational (none) - All Systems Operational (267ms)

✨ Testing complete! 7/7 passed
```

## Adding New Entries

### 1. Add to Directory

Edit `src/data/directory.ts`:

```typescript
{
  id: "stripe",
  name: "Stripe",
  url: "https://stripe.com",
  status_page_url: "https://status.stripe.com",
  provider: "atlassian-statuspage",
  industry: ["fintech"],
  description: "Online payment processing platform",
  api_config: {
    type: "atlassian",
  },
}
```

The directory is validated at startup using Zod, so invalid entries will fail immediately.

### 2. Test the Entry

```bash
bun test
```

### 3. Verify Manually

```typescript
import { getStatusDirectory } from "@openstatus/status-fetcher";
import { fetchers } from "@openstatus/status-fetcher/fetchers";

const stripe = getStatusDirectory().find((e) => e.id === "stripe");
const fetcher = fetchers.find((f) => f.canHandle(stripe!));
const status = await fetcher!.fetch(stripe!);
console.log(status);
```

## Implementing a Custom Parser

For companies with proprietary APIs (like Slack), add a parser to `CustomApiFetcher`:

```typescript
// In src/fetchers/custom.ts
private parseMyCompany(json: unknown): StatusResult {
  const schema = z.object({
    status: z.string(),
    lastUpdate: z.number(),
  });

  const data = schema.parse(json);

  return {
    severity: data.status === "ok" ? "none" : "major",
    status: data.status === "ok" ? "operational" : "major_outage",
    description: data.status === "ok" ? "All Systems Operational" : "Service Disruption",
    updated_at: data.lastUpdate,
    timezone: "UTC",
  };
}

private parseResponse(json: unknown, parser: string): StatusResult {
  switch (parser) {
    case "slack":
      return this.parseSlack(json);
    case "aws":
      return this.parseAws(json);
    case "mycompany":  // Add your parser
      return this.parseMyCompany(json);
    default:
      return this.parseGeneric(json);
  }
}
```

Then use it in your directory entry:

```typescript
{
  id: "mycompany",
  name: "My Company",
  url: "https://mycompany.com",
  status_page_url: "https://status.mycompany.com",
  provider: "custom",
  industry: ["saas"],
  api_config: {
    type: "custom",
    endpoint: "https://status.mycompany.com/api/current",
    parser: "mycompany",
  },
}
```

## Error Handling

The package provides rich error context through the `FetchError` class:

```typescript
import { FetchError } from "@openstatus/status-fetcher";

try {
  const status = await fetcher.fetch(entry);
} catch (error) {
  if (error instanceof FetchError) {
    console.error({
      message: error.message,      // "HTTP 500: Internal Server Error"
      url: error.url,              // "https://api.example.com/status"
      fetcherName: error.fetcherName,  // "atlassian"
      entryId: error.entryId,      // "github"
      cause: error.cause,          // Original error
    });
  }
}
```

## API Reference

### Exported Types

```typescript
// Core types
export type { StatusPageEntry, StatusResult, ApiConfig, StatusFetcher };

// Type unions
export type { StatusPageProvider, Industry, SeverityLevel, StatusType };

// Arrays (source of truth)
export {
  STATUS_PAGE_PROVIDERS,
  INDUSTRIES,
  SEVERITY_LEVELS,
  STATUS_TYPES,
  API_CONFIG_TYPES,
};

// Zod schemas
export {
  statusPageEntrySchema,
  statusPageProviderSchema,
  industrySchema,
  apiConfigSchema,
};

// Utilities
export { fetchWithTimeout, fetchWithRetry, FetchError };
export { inferStatus };
```

### Functions

```typescript
// Get the full directory
getStatusDirectory(): StatusPageEntry[]

// Infer status from description and severity
inferStatus(description: string, severity: SeverityLevel): StatusType

// Fetch with timeout
fetchWithTimeout(url: string, options?: FetchWithTimeoutOptions): Promise<Response>

// Fetch with retry
fetchWithRetry(url: string, options?: FetchWithTimeoutOptions & RetryOptions): Promise<Response>
```

## Performance Considerations

- **Validation overhead**: Directory validation happens once at module load (~1ms for 100 entries)
- **Retry timing**: Default retry strategy adds ~700ms max (100ms + 200ms + 400ms) for failures
- **Timeout**: 30s timeout per request prevents indefinite hanging
- **Parallel fetching**: Fetchers are stateless and can be called concurrently

```typescript
// Fetch multiple statuses in parallel
const statuses = await Promise.allSettled(
  directory.map(async (entry) => {
    const fetcher = fetchers.find((f) => f.canHandle(entry));
    return fetcher ? fetcher.fetch(entry) : null;
  }),
);
```

## Contributing

Contributions are welcome! Please:

1. Add tests for new features
2. Ensure all tests pass (`bun test`)
3. Follow existing code style
4. Update documentation

## Roadmap

- [ ] Database storage for status history
- [ ] Cron job for automated status updates
- [ ] Web UI displaying the directory
- [ ] Public REST API endpoint
- [ ] Community submission form
- [ ] Webhook notifications
- [ ] GraphQL API
- [ ] Status page analytics

## License

MIT

## Support

- 📚 [Documentation](https://github.com/openstatusHQ/openstatus)
- 🐛 [Report Issues](https://github.com/openstatusHQ/openstatus/issues)
- 💬 [Discord Community](https://openstatus.dev/discord)
