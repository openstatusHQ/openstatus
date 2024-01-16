import { Separator } from "@openstatus/ui";

import type { RegionCheck } from "../types";
import { getTotalLatency } from "../utils";
import { HighlightCard } from "./highlight-card";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";
import { ResponseHeaderTable } from "./response-header-table";
import { ResponseTimingTable } from "./response-timing-table";
import { SelectRegion } from "./select-region";

interface Props {
  regions: RegionCheck[];
  region?: string;
}

export function RequestDetails({ regions, region }: Props) {
  const selectedRegion =
    regions.find(({ name }) => name === region) || regions[0];

  const { status, name, headers, ...timing } = selectedRegion;

  const total = getTotalLatency(timing);

  return (
    <div className="grid gap-8">
      <p className="text-muted-foreground text-sm">
        {new Date().toLocaleString()}
      </p>
      <div>
        <MultiRegionChart regions={regions} />
      </div>
      <div>
        <MultiRegionTable regions={regions} />
      </div>
      <Separator />
      <SelectRegion defaultValue={region} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <HighlightCard title="Region" value={name} icon="globe" />
        <HighlightCard title="Status" value={200} icon="activity" />
        <HighlightCard
          title="Latency"
          value={`${total.toLocaleString()}ms`}
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
