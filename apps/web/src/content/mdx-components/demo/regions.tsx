import { AVAILABLE_REGIONS, getRegionInfo } from "@openstatus/regions";

import { auditRow, demo, formatNumber } from "@/data/demo-data";
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

const providerName = { fly: "Fly.io", koyeb: "Koyeb", railway: "Railway" };
const providers = [
  ...new Set(AVAILABLE_REGIONS.map((r) => getRegionInfo(r).provider)),
]
  .flatMap((p) => (p === "private" ? [] : providerName[p]))
  .join(" · ");

/** Latency per region, not an average; the failing regions stand out. */
export function RegionsDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Regions · {demo.monitor.name}</CellTitle>
        <CellDescription>
          last check {auditRow("monitor.alert").time} UTC
        </CellDescription>
      </CellHeader>
      <CellGrid cols={2} sm={3} className="text-xs">
        {demo.regions.map((region) => (
          <CellGridItem key={region.code}>
            <div className="flex justify-between gap-1.5">
              <span className="truncate">
                {getRegionInfo(region.code).flag} {region.code}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap",
                  region.status !== 200 && toneClass.destructive,
                )}
              >
                {formatNumber(region.ms)} ms
              </span>
            </div>
            <div className="text-muted-foreground text-xs">
              {region.city} · {region.cloud}
            </div>
          </CellGridItem>
        ))}
      </CellGrid>
      <CellFooter>
        <span>{demo.regions.length} regions selected</span>
        <span>{providers}</span>
      </CellFooter>
    </Cell>
  );
}
