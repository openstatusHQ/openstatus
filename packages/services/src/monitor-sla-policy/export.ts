import {
  formatSlaUptime,
  MONITOR_SLA_EXPORT_MAX_MONTHS,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { ValidationError } from "../errors";
import type { UptimeRunsRangePipes } from "../frozen-uptime/run";
import type { SlaEpisodesPipes } from "./fetch-episodes";
import {
  assertMonitorSlaLimit,
  judgePolicyMonths,
  loadPolicyMembers,
} from "./internal";
import { completeMonths, LAST_TWELVE, monthOf, monthsBetween } from "./months";
import { ExportMonitorSlaPolicyInput } from "./schemas";

export const MONITOR_SLA_METHOD =
  "Method: one run verdict per scheduled check across the cloud regions that reported it; request counts are not used. A run counts as slow only when at least half of the regions that reported it were slow or failed, and as failed only when at least half failed. Months with method time weigh each verdict by the time until the next check; gaps longer than twice the check interval are unmeasured and count neither way. Months with method runs were judged by run count.";

const COLUMNS = [
  "policy",
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
 * month states as `getMonitorSlaPolicy`. Live months only with `includeLive`.
 */
export async function exportMonitorSlaPolicy(args: {
  ctx: ServiceContext;
  input: ExportMonitorSlaPolicyInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ filename: string; csv: string }> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = ExportMonitorSlaPolicyInput.parse(args.input);
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
    runsRangePipes: args.runsRangePipes,
    sleep: args.sleep,
  });

  const lines = [
    `# ${MONITOR_SLA_METHOD}`,
    `# Generated ${now.toISOString()} by openstatus. Months are calendar months in ${timeZone}. Runs inside the policy's excused windows are left out of both sides of the uptime; excused_runs counts them, and a month whose runs were all excused has no judgement.${
      judged.monitors.some((m) => m.months.some((mm) => mm.unavailable))
        ? ` Unsealed months older than 45 days cannot be judged in ${timeZone}: their runs are kept per UTC day only.`
        : ""
    }${
      judged.excusedExpired
        ? " Some unsealed months are judged without their excused windows: the runs inside them are older than 45 days and can no longer be counted."
        : ""
    } Uptime is in percent, floored to three decimals. ${
      input.includeLive
        ? "Live months are provisional: they are not frozen or sealed yet and will change."
        : "Live months are not included."
    }${
      judged.liveIncomplete && input.includeLive
        ? " Runs could not be loaded for some monitors; their recent months are empty."
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
      .replace(/^-|-$/g, "") || `policy-${policy.id}`;
  return {
    filename: `sla-${slug}-${from}-to-${to}.csv`,
    csv: `${lines.join("\r\n")}\r\n`,
  };
}
