# Export Blog Post Metrics Script

This script exports monitor metrics data from OpenStatus for use in blog posts and documentation.

## Overview

The script fetches monitor data directly from the database and Tinybird analytics, then exports it to a JSON file that can be used for visualizations in blog posts.

**Features:**
- Fetches metrics from both regular regions and private locations
- Automatically combines public regions with private location data
- Supports both HTTP and TCP monitors

## Configuration

Edit the constants at the top of `export-blog-post-metrics.ts`:

```typescript
const MONITOR_ID = "1";        // The ID of the monitor to export
const PERIOD = "7d";           // Time period: "1d", "7d", or "14d"
const INTERVAL = 60;           // Interval in minutes for data points
const TYPE = "http";           // Fallback monitor type: "http" or "tcp" (auto-detected from monitor)
const OUTPUT_FILE = "blog-post-metrics.json"; // Output filename
```

**Note:** The script automatically detects the monitor type from the database, but you can set a fallback with the `TYPE` constant.

## Prerequisites

1. Make sure you have the `TINY_BIRD_API_KEY` environment variable set in your `.env` file
2. The database should be accessible (local or remote)
3. Install dependencies: `pnpm install`

## Usage

> [!IMPORTANT]
> Go to the `/tinybird/src/client.ts` file and make sure tb is **not using the NoopClient**.

From the `apps/dashboard` directory:

```bash
# Using the npm script
pnpm export-metrics

# Or directly with bun
bun src/scripts/export-blog-post-metrics.ts
```

## Output Format

The script generates a JSON file with the following structure:

```json
{
  "regions": ["ams", "fra", "lhr", ...],
  "data": {
    "regions": ["ams", "fra", "lhr", ...],
    "data": [
      {
        "timestamp": "2025-08-18T16:00:00.000Z",
        "ams": 207,
        "fra": 142,
        "lhr": 327,
        ...
      }
    ]
  },
  "metricsByRegions": [
    {
      "region": "ams",
      "count": 1000,
      "ok": 995,
      "p50Latency": 150,
      "p75Latency": 200,
      "p90Latency": 250,
      "p95Latency": 300,
      "p99Latency": 400
    }
  ]
}
```

## Data Fields

- **regions**: Array of region codes and private location names for the monitor
- **data.data**: Timeline data with latency values per region/location at each timestamp
- **metricsByRegions**: Summary statistics per region/location including:
  - `count`: Total number of checks
  - `ok`: Number of successful checks
  - `p50Latency`, `p75Latency`, `p90Latency`, `p95Latency`, `p99Latency`: Latency percentiles in milliseconds

**Note:** The script automatically includes both public Fly.io regions and any private locations connected to the monitor.

## Example: Moving to Web Assets

To use the exported data in the web app (like the existing `hono-cold.json`):

```bash
# After running the script
cp blog-post-metrics.json ../web/public/assets/posts/your-blog-post/data.json
```

## Troubleshooting

**Error: "TINY_BIRD_API_KEY environment variable is required"**
- Make sure you have the `TINY_BIRD_API_KEY` set in your `.env` file

**Error: "Monitor with ID X not found"**
- Verify the monitor ID exists in your database
- Check that you're connected to the correct database

**No data returned**
- Ensure the monitor has been running and collecting data for the specified period
- Try a different time period (e.g., "7d" instead of "1d")

