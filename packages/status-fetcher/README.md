# @openstatus/status-fetcher

Effect-based fetchers for third-party status pages. Each fetcher returns an
`Effect.Effect<StatusResult, FetchError>` so failures propagate through the
typed error channel and successful results carry a normalized shape across
providers.

## Quick start

```ts
import { Effect } from "effect";
import { FetchError, fetchers } from "@openstatus/status-fetcher";
import type { StatusPageEntry } from "@openstatus/status-fetcher";

const entry: StatusPageEntry = {
  id: "github",
  name: "GitHub",
  url: "https://github.com",
  status_page_url: "https://www.githubstatus.com",
  provider: "atlassian-statuspage",
  industry: ["development-tools"],
  api_config: { type: "atlassian" },
};

const fetcher = fetchers.find((f) => f.canHandle(entry));
if (!fetcher) throw new Error("no fetcher matches entry");

const result = await Effect.runPromise(fetcher.fetch(entry));
console.log(result.severity, result.status, result.description);
```

For batch fan-out with per-item success/failure, use `Effect.forEach` +
`Effect.either`:

```ts
import { Effect, Either } from "effect";

const results = await Effect.runPromise(
  Effect.forEach(
    entries,
    (entry) => {
      const fetcher = fetchers.find((f) => f.canHandle(entry));
      if (!fetcher) {
        return Effect.either(
          Effect.fail(
            new FetchError({ url: entry.status_page_url, entryId: entry.id }),
          ),
        );
      }
      return fetcher.fetch(entry).pipe(Effect.either);
    },
    { concurrency: "unbounded" },
  ),
);

for (const r of results) {
  if (Either.isRight(r)) {
    /* r.right is the StatusResult */
  } else {
    /* r.left is a FetchError */
  }
}
```

## Types

### `StatusPageEntry`

```ts
interface StatusPageEntry {
  id: string;
  name: string;
  url: string;
  status_page_url: string;
  provider: StatusPageProvider;
  industry: Industry[];
  description?: string;
  api_config?: ApiConfig;
}
```

### `StatusResult`

```ts
interface StatusResult {
  severity: SeverityLevel; // "none" | "minor" | "major" | "critical"
  status: StatusType;      // "operational" | "degraded" | "partial_outage" |
                           // "major_outage" | "under_maintenance" |
                           // "investigating" | "identified" |
                           // "monitoring" | "resolved"
  description: string;
  updated_at: number;      // ms since epoch
  timezone?: string;
}
```

### `FetchError`

Thrown via `Effect.fail` on any fetch failure. Always carries `url`; carries
`fetcherName` / `entryId` / `httpStatus` / `cause` when available.

```ts
class FetchError extends Error {
  readonly url: string;
  readonly fetcherName?: string;
  readonly entryId?: string;
  readonly httpStatus?: number;
  // `.cause: unknown` (inherited from Error)
}
```

The computed `.message` is `[<fetcherName> (<entryId>)] HTTP <status>: <url>`
or `[<fetcherName> (<entryId>)] fetch failed: <url>` when no HTTP status is
available.

## Retry & timeout

Each `fetchJson` / `fetchText` call:

- 30s timeout per attempt (via `Effect.timeoutFail`)
- Up to 3 retries on transient errors with exponential backoff
  (`Schedule.exponential("100 millis").pipe(Schedule.jittered)`)
- **4xx responses skip retry** (predicate fails fast)
- 5xx, network errors, and timeouts retry

## Supported providers

| Provider             | `api_config.type` | Notes                                                     |
| -------------------- | ----------------- | --------------------------------------------------------- |
| Atlassian Statuspage | `atlassian`       | `<status_page_url>/api/v2/summary.json`                   |
| Instatus             | `instatus`        | `<status_page_url>/summary.json`                          |
| BetterStack          | `betterstack`     | `<status_page_url>/index.json`                            |
| Incident.io          | `incidentio`      | `<origin>/api/widget` (Widget API must be enabled)        |
| UptimeRobot          | `uptimerobot`     | endpoint required — `<page>/api/getMonitorList/<u>-<p>`   |
| Custom JSON          | `custom`          | `parser: "slack" \| "aws" \| "generic"`                   |
| HTML scraper         | `html-scraper`    | universal fallback, opt-in only                           |

Fetcher selection is `fetchers.find((f) => f.canHandle(entry))`. Each
fetcher's `canHandle` ORs three signals: `api_config.type`, `provider`, and
hostname (`urlHostnameEndsWith`, which checks the URL hostname strictly to
avoid substring spoofing). The registry order in `src/fetchers/index.ts` is
deliberate: `Atlassian → Instatus → BetterStack → Incident.io → UptimeRobot →
Custom → HtmlScraper`. `Custom` and `HtmlScraper` only match when explicitly
configured.

## Adding a new fetcher

1. Subclass `StatusFetcher`:

   ```ts
   import { Effect } from "effect";
   import { z } from "zod";
   import { FetchError, fetchJson } from "../fetch";
   import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";

   const responseSchema = z.object({ /* ... */ });

   export class MyFetcher implements StatusFetcher {
     name = "myprovider";

     canHandle(entry: StatusPageEntry): boolean {
       return entry.api_config?.type === "myprovider";
     }

     fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
       return fetchJson({
         url: entry.api_config?.endpoint ?? "/* default */",
         schema: responseSchema,
         fetcherName: this.name,
         entryId: entry.id,
       }).pipe(
         Effect.map((data) => ({ /* StatusResult */ })),
       );
     }
   }
   ```

2. Register the class in `src/fetchers/index.ts` (before `Custom` /
   `HtmlScraper`).

3. Add `myprovider` to `API_CONFIG_TYPES` in `src/types.ts` if it's a new
   `api_config.type`, and to `STATUS_PAGE_PROVIDERS` if it's a new
   `provider`.

4. Write `__tests__/fetchers/myprovider.test.ts` using the helpers in
   `__tests__/helpers.ts` (`installMockFetch`, `runFetcher`,
   `runFetcherExit`, `expectFetchError`).

## Testing

```sh
bun test
```

Live smoke check against real status pages (GitHub, Linear, Slack,
Bluesky):

```sh
tsx scripts/test-fetchers.ts
```

## Internals

- `src/fetch.ts` — `fetchJson` / `fetchText` / `FetchError`. Defaults:
  `User-Agent: OpenStatus-Directory/1.0` and `Accept: application/json` for
  `fetchJson`; `User-Agent: Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)` for
  `fetchText`. Caller's `init.headers` override via spread merge.
- `src/utils.ts` — `inferStatus(description, severity)` keyword classifier
  and `urlHostnameEndsWith(url, domain)` strict hostname matcher.
- `src/types.ts` — single-source-of-truth `as const` arrays drive both
  TypeScript types and Zod schemas.

`fetchJson` / `fetchText` stay package-internal; only `FetchError`, the
fetcher registry, and the type surface are re-exported from the package
entry.
