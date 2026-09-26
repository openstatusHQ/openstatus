import { getRegionInfo } from "@openstatus/regions";

import { demo } from "@/data/demo-data";

import { Cell, CellFooter, CellLabel, CellRow, toneClass } from "./cell";

// Failing regions first, then a few healthy ones, one row per region check.
const rows = demo.regions.slice(0, 6).map((r, i) => ({
  ...r,
  time: `09:41:${String(12 - (i % 3)).padStart(2, "0")}`,
}));

// Fixed handshake cost; the failing regions spend the rest waiting on TTFB.
const PHASES = { dns: 12, connect: 38, tls: 61, transfer: 12 };

function phasesOf(ms: number) {
  const fixed = Object.values(PHASES).reduce((a, b) => a + b, 0);
  return [
    PHASES.dns,
    PHASES.connect,
    PHASES.tls,
    Math.max(ms - fixed, 0),
    PHASES.transfer,
  ];
}

// Columns of the dashboard's Logs table: dot, time, status, latency, region, timing.
// The timing bar is capped so the phases read as proportions, not as a full-width fill.
const columns =
  "grid grid-cols-[10px_64px_52px_72px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[10px_64px_52px_72px_104px_minmax(0,240px)]";

/** Every check kept: status, timing and body per region. */
export function LogsDemo() {
  return (
    <Cell>
      <CellRow className={columns}>
        <span />
        <CellLabel>Time</CellLabel>
        <CellLabel>Status</CellLabel>
        <CellLabel>Latency</CellLabel>
        <CellLabel>Region</CellLabel>
        <CellLabel className="hidden sm:block">Timing</CellLabel>
      </CellRow>
      {rows.map((r) => {
        const ok = r.status === 200;
        const phases = phasesOf(r.ms);
        const total = phases.reduce((a, b) => a + b, 0);
        return (
          <CellRow
            key={`${r.time}-${r.code}`}
            className={`${columns} py-1.5 text-xs`}
          >
            <span
              className={`size-2.5 rounded-xs ${ok ? "bg-success" : "bg-destructive"}`}
            />
            <span className="text-muted-foreground">{r.time}</span>
            <span className={ok ? "" : toneClass.destructive}>{r.status}</span>
            <span className={ok ? "" : toneClass.destructive}>
              {r.ms.toLocaleString("en-US")}
              <span className="text-muted-foreground"> ms</span>
            </span>
            <span className="truncate">
              {getRegionInfo(r.code).flag} {r.code}
            </span>
            <span className="hidden sm:flex">
              {phases.map((ms, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: phases are positional
                  key={i}
                  className="h-3"
                  style={{
                    width: `${(ms / total) * 100}%`,
                    backgroundColor: `var(--chart-${i + 1})`,
                  }}
                />
              ))}
            </span>
          </CellRow>
        );
      })}
      <CellFooter>
        <span>Headers and body kept for every failed check</span>
        <span>export to OTLP</span>
      </CellFooter>
    </Cell>
  );
}
