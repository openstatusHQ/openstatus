"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import { columns } from "./columns";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";
import type { RegionChecker } from "./utils";
import type { Row } from "@tanstack/react-table";
import { ResponseDetailTabs } from "./response-detail-tabs";
import type { Region } from "@openstatus/tinybird";

export function MultiRegionTabs({
  regions,
  selectedRegions,
}: {
  regions: RegionChecker[];
  selectedRegions?: Region[];
}) {
  return (
    <Tabs defaultValue="table">
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
      </TabsList>
      <TabsContent value="chart">
        <MultiRegionChart regions={regions} />
      </TabsContent>
      <TabsContent value="table">
        <MultiRegionTable
          data={regions.filter((i) => selectedRegions?.includes(i.region))}
          columns={columns}
          getRowCanExpand={() => true}
          renderSubComponent={renderSubComponent}
          selectedRegions={selectedRegions}
        />
      </TabsContent>
    </Tabs>
  );
}

function renderSubComponent({ row }: { row: Row<RegionChecker> }) {
  return <ResponseDetailTabs {...row.original} />;
}
