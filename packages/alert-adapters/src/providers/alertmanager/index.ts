import type { AlertAdapter, IngestedAlert } from "../../types";
import { AlertmanagerPayloadSchema } from "./api-types";
import { mapPayload } from "./mapper";

export const alertmanagerAdapter: AlertAdapter = {
  id: "alertmanager",
  parseBody(raw: string): unknown {
    return JSON.parse(raw);
  },
  groupKey(body: unknown): string | null {
    const payload = AlertmanagerPayloadSchema.parse(body);
    if (payload.groupKey) return payload.groupKey;
    const labels = Object.entries(payload.groupLabels).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (labels.length === 0) return null;
    return labels.map(([k, v]) => `${k}=${v}`).join(",");
  },
  formatAlerts(body: unknown): IngestedAlert[] {
    return mapPayload(AlertmanagerPayloadSchema.parse(body));
  },
};

export * from "./api-types";
export * from "./mapper";
