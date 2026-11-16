export const monitorUptimeEpisodeKinds = [
  "ok",
  "error",
  "degraded",
  "unmeasured",
] as const;
export type MonitorUptimeEpisodeKind =
  (typeof monitorUptimeEpisodeKinds)[number];
