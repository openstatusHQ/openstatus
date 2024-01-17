import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import type { RegionChecker } from "../utils";
import { MultiRegionChart } from "./multi-region-chart";
import { MultiRegionTable } from "./multi-region-table";

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
        <MultiRegionTable regions={regions} />
      </TabsContent>
    </Tabs>
  );
}
