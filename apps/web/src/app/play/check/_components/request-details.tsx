import type { MonitorFlyRegion } from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import type { RegionChecker } from "../utils";
import { valueFormatter } from "../utils";
import { HighlightCard } from "./highlight-card";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";
import { ResponseHeaderTable } from "./response-header-table";
import { ResponseTimingTable } from "./response-timing-table";
import { SelectRegion } from "./select-region";

interface Props {
  regions: RegionChecker[];
  searchRegion?: MonitorFlyRegion;
}

export function RequestDetails({ regions, searchRegion }: Props) {
  const selectedRegion =
    regions.find((i) => i.region === searchRegion) || regions[0];

  const { status, region, headers, latency, time, timing } = selectedRegion;

  return (
    <div className="grid gap-8">
      <p className="text-muted-foreground text-sm">
        {new Date(time).toLocaleString()}
      </p>
      <div>
        <MultiRegionChart regions={regions} />
      </div>
      <div>
        <MultiRegionTable regions={regions} />
      </div>
      <Separator />
      <SelectRegion defaultValue={searchRegion} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <HighlightCard title="Region" value={region} icon="globe" />
        <HighlightCard title="Status" value={status} icon="activity" />
        <HighlightCard
          title="Latency"
          value={valueFormatter(latency)}
          icon="timer"
        />
      </div>
      <div>
        <ResponseTimingTable timing={timing} />
      </div>
      <div>
        <ResponseHeaderTable headers={headers} />
      </div>
    </div>
  );
}
