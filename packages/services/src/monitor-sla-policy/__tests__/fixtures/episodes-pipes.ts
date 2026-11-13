import { episodesFromRuns, type Verdict } from "../../episodes";
import type { SlaEpisodesPipeFn, SlaEpisodesPipes } from "../../fetch-episodes";

export type Run = { cronTimestamp: number; verdict: Verdict };
export type EpisodesCall = {
  monitorIds: string[];
  fromDate: number;
  toDate: number;
  fallbackIntervalMs: number;
};

/** Runs every `stepMs` in [fromMs, toMs); `verdictAt` labels each. */
export function runsEvery(
  fromMs: number,
  toMs: number,
  stepMs: number,
  verdictAt: (t: number) => Verdict = () => "ok",
): Run[] {
  const runs: Run[] = [];
  for (let t = fromMs; t < toMs; t += stepMs) {
    runs.push({ cronTimestamp: t, verdict: verdictAt(t) });
  }
  return runs;
}

/** Pipes that answer like the Tinybird endpoint, from the TS reference over `runsOf(monitorId)`. */
export function episodesPipesFrom(
  runsOf: (monitorId: string) => Run[],
  calls: EpisodesCall[] = [],
): SlaEpisodesPipes {
  const pipe: SlaEpisodesPipeFn = async (params) => {
    calls.push(params);
    return {
      data: params.monitorIds.flatMap((monitorId) =>
        episodesFromRuns({
          runs: runsOf(monitorId),
          fromMs: params.fromDate,
          toMs: params.toDate,
          fallbackIntervalMs: params.fallbackIntervalMs,
        }).map((e) => ({ monitorId, ...e })),
      ),
    };
  };
  return { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe };
}

export function failingEpisodesPipes(): SlaEpisodesPipes {
  const pipe: SlaEpisodesPipeFn = async () => {
    throw new Error("tinybird down");
  };
  return { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe };
}

export const noEpisodes = episodesPipesFrom(() => []);
