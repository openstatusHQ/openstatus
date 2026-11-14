import {
  formatSlaUptime,
  MONITOR_SLA_EXPORT_MAX_MONTHS,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { ValidationError } from "../errors";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  judgePolicyMonths,
  loadPolicyMembers,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, monthsBetween } from "./months";
import { ExportMonitorReportingInput } from "./schemas";

export const MONITOR_SLA_METHOD =
  "Method: one run verdict per scheduled check across the cloud regions that reported it; request counts are not used. A run counts as slow only when at least half of the regions that reported it were slow or failed, and as failed only when at least half failed. Each verdict is weighted by the time until the next check. When a gap between two checks is more than twice the longer of the gaps before and after it, the earlier verdict covers only that longer gap and the rest is unmeasured; the time before the first check and after the last follow the same rule. Unmeasured time counts neither way.";

const COLUMNS = [
  "reporting",
  "target",
  "strict",
  "monitor_id",
  "monitor_name",
  "monitor_url",
  "month",
  "state",
  "ok_runs",
  "degraded_runs",
  "failed_runs",
  "excused_runs",
  "uptime",
  "met",
  "sealed_at",
  "method",
  "time_zone",
  "measured_ms",
  "down_ms",
  "excused_ms",
  "unmeasured_ms",
  "coverage",
];

// quotes when needed; a leading formula character is neutralised for spreadsheets
function cell(value: string | number | null): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * A policy's months as CSV, one row per monitor and month, from the same
 * month states as `getMonitorReporting`. Live months only with `includeLive`.
 */
export async function exportMonitorReporting(args: {
  ctx: ServiceContext;
  input: ExportMonitorReportingInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ filename: string; csv: string }> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ExportMonitorReportingInput.parse(args.input);
  assertMonitorSlaLimit(ctx);
  const now = args.now ?? new Date();
  const { policy, monitors } = await loadPolicyMembers(ctx, input.id);

  const { timeZone } = policy;
  const defaults = completeMonths(now, LAST_TWELVE, timeZone);
  const from = input.from ?? defaults[0].slice(0, 7);
  const to = input.to ?? defaults[LAST_TWELVE - 1].slice(0, 7);
  if (from > to) {
    throw new ValidationError("The first month must not be after the last.");
  }
  if (`${to}-01` > monthOf(now, timeZone)) {
    throw new ValidationError("The last month must not be in the future.");
  }
  const months = monthsBetween(from, to);
  if (months.length > MONITOR_SLA_EXPORT_MAX_MONTHS) {
    throw new ValidationError(
      `Export at most ${MONITOR_SLA_EXPORT_MAX_MONTHS} months at once.`,
    );
  }

  const judged = await judgePolicyMonths({
    ctx,
    policy,
    monitors,
    months,
    now,
    live: input.includeLive,
    episodesPipes: args.episodesPipes,
    sleep: args.sleep,
  });

  const lines = [
    `# ${MONITOR_SLA_METHOD}`,
    `# Generated ${now.toISOString()} by openstatus. Months are calendar months in ${timeZone}. Runs inside the policy's excused windows are left out of both sides of the uptime; excused_runs counts them, and a month whose runs were all excused has no judgement. Months that were never sealed and are no longer the running or previous month, or whose checks are no longer kept, have no judgement. Uptime is in percent, floored to three decimals. ${
      input.includeLive
        ? "Live months are provisional: they are not sealed yet and will change."
        : "Live months are not included."
    }${
      judged.liveIncomplete
        ? " Runs could not be loaded for some monitors and months; those months have no judgement."
        : ""
    }`,
    COLUMNS.join(","),
  ];
  for (const m of judged.monitors) {
    for (const mm of m.months) {
      if (mm.state === "live" && !input.includeLive) continue;
      const terms = mm.terms ?? policy;
      lines.push(
        [
          cell(policy.name),
          cell(formatSlaUptime(terms.target)),
          cell(terms.strict ? "yes" : "no"),
          cell(m.id),
          cell(m.name),
          cell(m.url),
          cell(mm.month.slice(0, 7)),
          cell(mm.state === "live" ? "live (provisional)" : mm.state),
          cell(mm.counts?.ok ?? null),
          cell(mm.counts?.degraded ?? null),
          cell(mm.counts?.error ?? null),
          cell(
            mm.excused
              ? mm.excused.ok + mm.excused.degraded + mm.excused.error
              : null,
          ),
          cell(mm.uptime === null ? null : formatSlaUptime(mm.uptime)),
          cell(mm.met === null ? null : mm.met ? "yes" : "no"),
          cell(mm.sealed?.at.toISOString() ?? null),
          cell(mm.method),
          cell(mm.timeZone),
          cell(mm.measuredMs),
          cell(mm.downMs),
          cell(mm.excusedMs),
          cell(mm.unmeasuredMs),
          cell(mm.coverage === null ? null : formatSlaUptime(mm.coverage)),
        ].join(","),
      );
    }
  }

  const slug =
    policy.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `reporting-${policy.id}`;
  return {
    filename: `sla-${slug}-${from}-to-${to}.csv`,
    csv: `${lines.join("\r\n")}\r\n`,
  };
}
