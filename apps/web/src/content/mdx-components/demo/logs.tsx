import { getRegionInfo } from "@openstatus/regions";

import { auditRow, demo, formatNumber } from "@/data/demo-data";
import { cn } from "@/lib/utils";

import {
  Cell,
  CellFooter,
  CellLabel,
  CellPhaseBar,
  CellRow,
  toneClass,
} from "./cell";

const time = auditRow("monitor.alert").time;

// Same handshake cost in every region; the failing ones spend the rest on TTFB.
const fixed = demo.timing.phases
  .filter((t) => t.phase !== "TTFB")
  .reduce((sum, t) => sum + t.ms, 0);

function phasesOf(ms: number) {
  return demo.timing.phases.map((t) => ({
    ...t,
    ms: t.phase === "TTFB" ? Math.max(ms - fixed, 0) : t.ms,
  }));
}

// The timing bar is capped so the phases read as proportions, not as a full-width fill.
const columns =
  "grid grid-cols-[64px_52px_72px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[64px_52px_72px_104px_minmax(0,240px)]";

/** Every check kept: status, timing and body per region. */
export function LogsDemo() {
  return (
    <Cell>
      <CellRow className={columns}>
        <CellLabel>Time</CellLabel>
        <CellLabel>Status</CellLabel>
        <CellLabel>Latency</CellLabel>
        <CellLabel>Region</CellLabel>
        <CellLabel className="hidden sm:block">Timing</CellLabel>
      </CellRow>
      {demo.regions.map((r) => {
        const ok = r.status === 200;
        return (
          <CellRow key={r.code} className={cn(columns, "py-1.5 text-xs")}>
            <span className="text-muted-foreground">{time}</span>
            <span className={ok ? "" : toneClass.destructive}>{r.status}</span>
            <span className={ok ? "" : toneClass.destructive}>
              {formatNumber(r.ms)}
              <span className="text-muted-foreground"> ms</span>
            </span>
            <span className="truncate">
              {getRegionInfo(r.code).flag} {r.code}
            </span>
            <CellPhaseBar phases={phasesOf(r.ms)} className="hidden sm:flex" />
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
