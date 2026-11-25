import { demo, formatNumber } from "@/data/demo-data";
import { cn } from "@/lib/utils";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellHeader,
  CellTitle,
  chartClass,
} from "./cell";

const total = demo.timing.phases.reduce((sum, t) => sum + t.ms, 0);
const slowPhase = demo.timing.phases.find(
  (t) => t.ms > demo.monitor.degradedAfter,
);

/** Where the 4 seconds went: one request, phase by phase. */
export function TimingDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>
          {demo.monitor.name} · {demo.timing.region}
        </CellTitle>
        <CellDescription>{formatNumber(total)} ms total</CellDescription>
      </CellHeader>
      <CellBody className="space-y-1.5 text-xs">
        {demo.timing.phases.map((phase, i) => {
          const pct = Math.max(1, Math.round((phase.ms / total) * 100));
          const slow = phase.ms > demo.monitor.degradedAfter;
          return (
            <div
              key={phase.phase}
              className="grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-3"
            >
              <span className="text-muted-foreground">{phase.phase}</span>
              <span className="bg-muted block h-3">
                <span
                  className={cn("block h-3", chartClass[i % chartClass.length])}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span
                className={cn("text-right", !slow && "text-muted-foreground")}
              >
                {formatNumber(phase.ms)} ms
              </span>
            </div>
          );
        })}
      </CellBody>
      <CellFooter>
        <span>
          {slowPhase?.phase ?? "Nothing"} above the degraded threshold
        </span>
        <span>
          degraded after {formatNumber(demo.monitor.degradedAfter)} ms
        </span>
      </CellFooter>
    </Cell>
  );
}
