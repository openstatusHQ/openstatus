import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

// WARNING: make sure to enable the Tinybird client in the env you are running this script in

// Configuration
const MONITOR_ID = "7002";
const PERIOD = "7d" as const;
const INTERVAL = 60;
const TYPE = "http" as const;
const OUTPUT_FILE = "blog-post-metrics.json";
const PERCENTILE = "p50"; // p50, p75, p90, p95, p99

async function main() {
  // Get Tinybird API key from environment
  const tinybirdApiKey = process.env.TINY_BIRD_API_KEY;
  if (!tinybirdApiKey) {
    throw new Error("TINY_BIRD_API_KEY environment variable is required");
  }

  const tb = new OSTinybird(tinybirdApiKey);

  console.log(`Fetching data for monitor ID: ${MONITOR_ID}`);

  // 1. Fetch monitor from database with private locations
  const monitorDataRaw = await db.query.monitor.findFirst({
    where: eq(monitor.id, Number.parseInt(MONITOR_ID)),
    with: {
      privateLocationToMonitors: {
        with: {
          privateLocation: true,
        },
      },
    },
  });

  if (!monitorDataRaw) {
    throw new Error(`Monitor with ID ${MONITOR_ID} not found`);
  }

  // Parse the monitor data using the schema to convert regions string to array
  const monitorData = selectMonitorSchema.parse(monitorDataRaw);

  // Get private location names
  const privateLocationNames =
    monitorDataRaw.privateLocationToMonitors
      ?.map((pl) => pl.privateLocation?.name)
      .filter((name): name is string => Boolean(name)) || [];

  // Combine regular regions with private locations
  const allRegions = [...monitorData.regions, ...privateLocationNames];

  console.log(`\nMonitor Details:`);
  console.log(`  ID: ${MONITOR_ID}`);
  console.log(`  Name: ${monitorData.name || "Unnamed"}`);
  console.log(`  Type: ${monitorData.jobType}`);
  console.log(`  Active: ${monitorData.active}`);
  console.log(`  Created: ${monitorData.createdAt}`);
  console.log(`  Regular regions: ${monitorData.regions.join(", ")}`);
  console.log(
    `  Private locations: ${privateLocationNames.join(", ") || "None"}`
  );
  console.log(`  Total regions: ${allRegions.length}`);
  console.log(`\nQuery Parameters:`);
  console.log(`  Period: ${PERIOD}`);
  console.log(`  Interval: ${INTERVAL} minutes`);

  // Use the monitor's actual type, or fall back to the configured TYPE
  const monitorType = (monitorData.jobType || TYPE) as "http" | "tcp";

  // 2. Fetch metricsRegions (timeline data with region, timestamp, and quantiles)
  const metricsRegionsResult =
    monitorType === "http"
      ? PERIOD === "7d"
        ? await tb.httpMetricsRegionsWeekly({
            monitorId: MONITOR_ID,
            interval: INTERVAL,
          })
        : await tb.httpMetricsRegionsDaily({
            monitorId: MONITOR_ID,
            interval: INTERVAL,
          })
      : PERIOD === "7d"
      ? await tb.tcpMetricsByIntervalWeekly({
          monitorId: MONITOR_ID,
          interval: INTERVAL,
        })
      : await tb.tcpMetricsByIntervalDaily({
          monitorId: MONITOR_ID,
          interval: INTERVAL,
        });

  console.log(
    `\nFetched ${metricsRegionsResult.data.length} metrics regions data points`
  );
  if (metricsRegionsResult.data.length > 0) {
    console.log(
      `  First data point:`,
      JSON.stringify(metricsRegionsResult.data[0], null, 2)
    );
    console.log(
      `  Last data point:`,
      JSON.stringify(
        metricsRegionsResult.data[metricsRegionsResult.data.length - 1],
        null,
        2
      )
    );
  } else {
    console.log(`  ⚠️  No data returned. This could mean:`);
    console.log(`     - The monitor hasn't collected any data yet`);
    console.log(`     - The monitor is inactive or was just created`);
    console.log(
      `     - There's no data in the selected time period (${PERIOD})`
    );
    console.log(
      `\n  💡 Tip: Try querying without the interval parameter or using PERIOD="1d"`
    );

    // Try without interval to see if that helps
    console.log(`\n  Trying without interval parameter...`);
    const retryResult =
      monitorType === "http"
        ? PERIOD === "7d"
          ? await tb.httpMetricsRegionsWeekly({
              monitorId: MONITOR_ID,
            })
          : await tb.httpMetricsRegionsDaily({
              monitorId: MONITOR_ID,
            })
        : PERIOD === "7d"
        ? await tb.tcpMetricsByIntervalWeekly({
            monitorId: MONITOR_ID,
          })
        : await tb.tcpMetricsByIntervalDaily({
            monitorId: MONITOR_ID,
          });
    console.log(`  Retry returned ${retryResult.data.length} data points`);
    if (retryResult.data.length > 0) {
      console.log(`  ✅ Success! The interval parameter might be the issue.`);
      console.log(
        `     First data point:`,
        JSON.stringify(retryResult.data[0], null, 2)
      );
    }
  }

  // 3. Fetch metricsByRegion (summary data by region)
  const metricsByRegionProcedure =
    monitorType === "http"
      ? PERIOD === "7d"
        ? tb.httpMetricsByRegionWeekly
        : tb.httpMetricsByRegionDaily
      : PERIOD === "7d"
      ? tb.tcpMetricsByRegionWeekly
      : tb.tcpMetricsByRegionDaily;

  const metricsByRegionsResult = await metricsByRegionProcedure({
    monitorId: MONITOR_ID,
  });

  console.log(
    `\nFetched ${metricsByRegionsResult.data.length} metrics by region data points`
  );
  if (metricsByRegionsResult.data.length > 0) {
    console.log(
      `  Sample:`,
      JSON.stringify(metricsByRegionsResult.data.slice(0, 3), null, 2)
    );
  }

  // 4. Transform metricsRegions data to match expected format
  // Group by timestamp and pivot regions as columns
  const timelineMap = new Map<number, Record<string, number | string>>();

  for (const row of metricsRegionsResult.data) {
    const timestamp = row.timestamp;
    const region = row.region;
    const latency = row[`${PERCENTILE}Latency`] ?? 0;

    if (!timelineMap.has(timestamp)) {
      timelineMap.set(timestamp, {
        timestamp: new Date(timestamp).toISOString(),
      });
    }

    const entry = timelineMap.get(timestamp)!;
    entry[region] = latency;
  }

  // Convert map to sorted array
  const timelineData = Array.from(timelineMap.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp as string).getTime();
    const timeB = new Date(b.timestamp as string).getTime();
    return timeA - timeB;
  });

  // 5. Build final output structure
  const output = {
    regions: allRegions,
    data: {
      regions: allRegions,
      data: timelineData,
    },
    metricsByRegions: metricsByRegionsResult.data,
  };

  // 6. Write to file
  const outputPath = resolve(process.cwd(), OUTPUT_FILE);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Data exported successfully to: ${outputPath}`);
  console.log(`Total timeline entries: ${timelineData.length}`);
  console.log(
    `Total regions (including private locations): ${allRegions.length}`
  );
}

// Run the script
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
