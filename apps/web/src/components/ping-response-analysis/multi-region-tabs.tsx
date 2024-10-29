"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import type { Region } from "@openstatus/db/src/schema/constants";
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
      <div className="flex items-center justify-between gap-2">
        <TabsList className="h-8 p-0.5">
          <TabsTrigger value="table" className="h-7">
            Table
          </TabsTrigger>
          <TabsTrigger value="chart" className="h-7">
            Chart
          </TabsTrigger>
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
