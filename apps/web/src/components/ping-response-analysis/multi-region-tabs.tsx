"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import type { Region } from "@openstatus/tinybird";
import type { Row } from "@tanstack/react-table";
import { RegionsPreset } from "../monitor-dashboard/region-preset";
import { columns } from "./columns";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";
import { ResponseDetailTabs } from "./response-detail-tabs";
import type { RegionChecker } from "./utils";

export function MultiRegionTabs({
  regions,
  selectedRegions,
}: {
  regions: RegionChecker[];
  selectedRegions?: Region[];
}) {
  return (
    <Tabs defaultValue="table">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
        <RegionsPreset
          regions={regions.map((i) => i.region)}
          selectedRegions={selectedRegions ?? []}
          size="sm"
        />
      </div>
      <TabsContent value="chart" className="mt-3">
        <MultiRegionChart
          regions={regions.filter((i) => selectedRegions?.includes(i.region))}
        />
      </TabsContent>
      <TabsContent value="table" className="mt-3">
        <MultiRegionTable
          data={regions.filter((i) => selectedRegions?.includes(i.region))}
          columns={columns}
          getRowCanExpand={() => true}
          renderSubComponent={renderSubComponent}
        />
      </TabsContent>
    </Tabs>
  );
}

function renderSubComponent({ row }: { row: Row<RegionChecker> }) {
  return <ResponseDetailTabs {...row.original} />;
}
