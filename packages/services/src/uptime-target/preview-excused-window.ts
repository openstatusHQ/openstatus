import { requireScope } from "../auth";
import { defaultTb, type ServiceContext } from "../context";
import {
  clipEpisodes,
  fetchUptimeEpisodes,
  type UptimeEpisodesPipes,
  uptimeEpisodesPipes,
} from "./fetch-episodes";
import { assertUptimeTargetLimit, loadPolicyMembers } from "./internal";
import { PreviewUptimeTargetExcusedWindowInput } from "./schemas";

/**
 * Per monitor of the policy, the time inside a past window that checks measured.
 * `measuredMs` is null when it cannot be told: the window has not ended, the read failed, or the monitor's type records no run verdicts; 0 when no check landed.
 */
export async function previewUptimeTargetExcusedWindow(args: {
  ctx: ServiceContext;
  input: PreviewUptimeTargetExcusedWindowInput;
  now?: Date;
  episodesPipes?: UptimeEpisodesPipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = PreviewUptimeTargetExcusedWindowInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  const { monitors } = await loadPolicyMembers(ctx, input.policyId);
  const now = args.now ?? new Date();
  // runs can still land in a window that has not ended
  if (input.to > now) {
    return {
      monitors: monitors.map((m) => ({
        id: m.id,
        name: m.name,
        measuredMs: null,
      })),
    };
  }
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();

  const { episodes, failed } = await fetchUptimeEpisodes({
    monitors,
    fromMs,
    toMs,
    pipes: () => args.episodesPipes ?? uptimeEpisodesPipes(ctx.tb ?? defaultTb),
    throttleMs: 0,
    sleep: args.sleep,
  });

  return {
    monitors: monitors.map((m) => {
      const list = episodes.get(m.id);
      if (failed.has(m.id) || !list) {
        return { id: m.id, name: m.name, measuredMs: null };
      }
      const measuredMs = clipEpisodes(list, fromMs, toMs)
        .filter((e) => e.kind !== "unmeasured")
        .reduce((sum, e) => sum + e.endedAt - e.startedAt, 0);
      return { id: m.id, name: m.name, measuredMs };
    }),
  };
}
