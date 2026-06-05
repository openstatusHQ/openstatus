import { Effect } from "effect";
import { fetchers } from "../src/fetchers";
import type { SeverityLevel, StatusPageEntry } from "../src/types";

const fixtures: StatusPageEntry[] = [
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    status_page_url: "https://www.githubstatus.com",
    provider: "atlassian-statuspage",
    industry: ["development-tools"],
    api_config: { type: "atlassian" },
  },
  {
    id: "linear",
    name: "Linear",
    url: "https://linear.app",
    status_page_url: "https://status.linear.app",
    provider: "incidentio",
    industry: ["development-tools"],
    api_config: { type: "incidentio" },
  },
  {
    id: "slack",
    name: "Slack",
    url: "https://slack.com",
    status_page_url: "https://slack-status.com",
    provider: "custom",
    industry: ["communication"],
    api_config: {
      type: "custom",
      endpoint: "https://slack-status.com/api/v2.0.0/current",
      parser: "slack",
    },
  },
  {
    id: "bluesky",
    name: "Bluesky",
    url: "https://bsky.app",
    status_page_url: "https://status.bsky.app",
    provider: "uptime-robot",
    industry: ["communication"],
    api_config: {
      type: "uptimerobot",
      endpoint: "https://status.bsky.app/api/getMonitorList/2102707-357837",
    },
  },
];

async function testFetchers() {
  const directory = fixtures;

  console.log(`\n🔍 Testing ${directory.length} entries...\n`);

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const entry of directory) {
    if (!entry.api_config) {
      console.log(`⏭️  ${entry.name}: No API config`);
      skippedCount++;
      continue;
    }

    const fetcher = fetchers.find((f) => f.canHandle(entry));

    if (!fetcher) {
      console.log(`❌ ${entry.name}: No fetcher found`);
      failureCount++;
      continue;
    }

    try {
      const startTime = Date.now();
      const status = await Effect.runPromise(fetcher.fetch(entry));
      const duration = Date.now() - startTime;

      const statusEmoji = getStatusEmoji(status.severity);
      const statusText = `${status.status} (${status.severity})`;

      console.log(
        `${statusEmoji} ${entry.name}: ${statusText} - ${status.description} (${duration}ms)`,
      );
      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`❌ ${entry.name}: ${errorMessage}`);
      failureCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`Total entries: ${directory.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(
    `Success rate: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%`,
  );
  console.log("\n✨ Testing complete!\n");

  // Exit with error code if any failures
  if (failureCount > 0) {
    process.exit(1);
  }
}

/**
 * Get emoji for severity level
 */
function getStatusEmoji(severity: SeverityLevel): string {
  switch (severity) {
    case "none":
      return "✅";
    case "minor":
      return "⚠️";
    case "major":
      return "🔴";
    case "critical":
      return "💥";
    default:
      return "❓";
  }
}

testFetchers().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
