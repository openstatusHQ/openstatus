export type RouteContext =
  | { type: "monitor"; id: number }
  | { type: "status-page"; id: number; reportId?: number }
  | { type: "incident"; id: number };

// Only numeric segments are entities: `/monitors/create` and the `_` redirect
// routes share the `[id]` position.
const ID = "(\\d+)";
const MONITOR = new RegExp(`^/monitors/${ID}(?:/|$)`);
const STATUS_PAGE = new RegExp(
  `^/status-pages/${ID}(?:/status-reports/${ID})?(?:/|$)`,
);
const INCIDENT = new RegExp(`^/incidents/${ID}(?:/|$)`);

export function routeContext(pathname: string): RouteContext | null {
  const monitor = MONITOR.exec(pathname);
  if (monitor) return { type: "monitor", id: Number(monitor[1]) };

  const statusPage = STATUS_PAGE.exec(pathname);
  if (statusPage) {
    return {
      type: "status-page",
      id: Number(statusPage[1]),
      ...(statusPage[2] ? { reportId: Number(statusPage[2]) } : {}),
    };
  }

  const incident = INCIDENT.exec(pathname);
  if (incident) return { type: "incident", id: Number(incident[1]) };

  return null;
}
