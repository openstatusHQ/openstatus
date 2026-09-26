import { demo } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellHeader,
  CellTitle,
} from "./cell";

const total = demo.timing.reduce((sum, t) => sum + t.ms, 0);

/** Where the 4 seconds went: one request, phase by phase. */
export function TimingDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{demo.monitor.name} · lhr</CellTitle>
        <CellDescription>
          {total.toLocaleString("en-US")} ms total
        </CellDescription>
      </CellHeader>
      <CellBody className="space-y-1.5 text-xs">
        {demo.timing.map((phase, i) => {
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
                  className="block h-3"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: `var(--chart-${i + 1})`,
                  }}
                />
              </span>
              <span
                className={`text-right ${slow ? "" : "text-muted-foreground"}`}
              >
                {phase.ms.toLocaleString("en-US")} ms
              </span>
            </div>
          );
        })}
      </CellBody>
      <CellFooter>
        <span>TLS above the degraded threshold</span>
        <span>
          degraded after {demo.monitor.degradedAfter.toLocaleString("en-US")} ms
        </span>
      </CellFooter>
    </Cell>
  );
}
