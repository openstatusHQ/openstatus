import { requireScope } from "../auth";
import { defaultTb, type ServiceContext } from "../context";
import {
  clipEpisodes,
  fetchSlaEpisodes,
  type SlaEpisodesPipes,
  slaEpisodesPipes,
} from "./fetch-episodes";
import { assertMonitorSlaLimit, loadPolicyMembers } from "./internal";
import { PreviewMonitorReportingExcusedWindowInput } from "./schemas";

/**
 * Per monitor of the policy, the scheduled runs recorded inside a past window.
 * `runs` is null when it cannot be told: the window has not ended, the read failed, or the monitor has no runs.
 */
export async function previewMonitorReportingExcusedWindow(args: {
  ctx: ServiceContext;
  input: PreviewMonitorReportingExcusedWindowInput;
  now?: Date;
  episodesPipes?: SlaEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = PreviewMonitorReportingExcusedWindowInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  const { monitors } = await loadPolicyMembers(ctx, input.policyId);
  const now = args.now ?? new Date();
  // runs can still land in a window that has not ended
  if (input.to > now) {
    return {
      monitors: monitors.map((m) => ({ id: m.id, name: m.name, runs: null })),
    };
  }
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();

  const { episodes, failed } = await fetchSlaEpisodes({
    monitors,
    fromMs,
    toMs,
    pipes: () => args.episodesPipes ?? slaEpisodesPipes(ctx.tb ?? defaultTb),
    throttleMs: 0,
    sleep: args.sleep,
  });

  return {
    monitors: monitors.map((m) => {
      const list = episodes.get(m.id);
      if (failed.has(m.id) || !list) {
        return { id: m.id, name: m.name, runs: null };
      }
      const runs = clipEpisodes(list, fromMs, toMs)
        .filter((e) => e.kind !== "unmeasured")
        .reduce((sum, e) => sum + e.runs, 0);
      return { id: m.id, name: m.name, runs };
    }),
  };
}
