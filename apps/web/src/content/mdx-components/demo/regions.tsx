import { demo } from "@/data/demo-data";
import { cn } from "@/lib/utils";

import {
  Cell,
  CellDescription,
  CellFooter,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellTitle,
  toneClass,
} from "./cell";

/** Latency per region, not an average; the failing regions stand out. */
export function RegionsDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Regions · {demo.monitor.name}</CellTitle>
        <CellDescription>last check 09:41:12 UTC</CellDescription>
      </CellHeader>
      <CellGrid cols={2} sm={3} className="text-xs">
        {demo.regions.map((region) => (
          <CellGridItem key={region.code} className="px-2">
            <div className="flex justify-between gap-1.5">
              <span>{region.code}</span>
              <span
                className={cn(
                  "whitespace-nowrap",
                  region.status !== 200 && toneClass.destructive,
                )}
              >
                {region.ms.toLocaleString("en-US")} ms
              </span>
            </div>
            <div className="text-muted-foreground text-[11px]">
              {region.city} · {region.cloud}
            </div>
          </CellGridItem>
        ))}
      </CellGrid>
      <CellFooter>
        <span>{demo.regions.length} of 28 regions selected</span>
        <span>Fly.io · Koyeb · Railway</span>
      </CellFooter>
    </Cell>
  );
}
