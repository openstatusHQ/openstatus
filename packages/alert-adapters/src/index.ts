import { alertmanagerAdapter } from "./providers/alertmanager";
import { grafanaAdapter } from "./providers/grafana";
import type { AlertAdapter } from "./types";

export * from "./types";
export { alertmanagerAdapter } from "./providers/alertmanager";
export { grafanaAdapter } from "./providers/grafana";

/**
 * Explicit registry. Not auto-discovery: `deno compile --node-modules-dir=none`
 * cannot resolve dynamic imports of bare specifiers, so a scanned directory
 * would build fine and fail in the compiled binary.
 */
export const ALERT_ADAPTERS = {
  alertmanager: alertmanagerAdapter,
  grafana: grafanaAdapter,
} as const satisfies Record<string, AlertAdapter>;

export type AlertAdapterId = keyof typeof ALERT_ADAPTERS;

export function getAlertAdapter(id: string): AlertAdapter | null {
  return id in ALERT_ADAPTERS ? ALERT_ADAPTERS[id as AlertAdapterId] : null;
}
