import type { CheckResult } from "@openstatus/services/monitor";
import type { StatusBarData } from "@openstatus/ui/components/blocks/status.types";

export function deriveTodayBar(results: CheckResult[]): StatusBarData | null {
  if (results.length === 0) return null;
  let up = 0;
  for (const r of results) {
    if (r.state === "success" && r.status >= 200 && r.status <= 399) up++;
  }
  const count = results.length;
  const down = count - up;
  const upHeight = Math.round((up / count) * 100);
  const downStatus = down / count > 0.5 ? "error" : "degraded";
  const bar: StatusBarData["bar"] = [];
  if (up > 0) bar.push({ status: "success", height: upHeight });
  if (down > 0) bar.push({ status: downStatus, height: 100 - upHeight });
  const dayStatus = down === 0 ? "success" : downStatus;
  const day = new Date().toISOString().slice(0, 10);
  return {
    day,
    bar,
    card: [{ status: dayStatus, value: `${upHeight}%` }],
    events: [],
  };
}
