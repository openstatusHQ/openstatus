import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import { columns } from "./columns";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";
import type { RegionChecker } from "./utils";

export function MultiRegionTabs({ regions }: { regions: RegionChecker[] }) {
  return (
    <Tabs defaultValue="chart">
      <TabsList>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="table">Table</TabsTrigger>
      </TabsList>
      <TabsContent value="chart">
        <MultiRegionChart regions={regions} />
      </TabsContent>
      <TabsContent value="table">
        <MultiRegionTable data={regions} columns={columns} />
      </TabsContent>
    </Tabs>
  );
}
