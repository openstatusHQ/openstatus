import type { AlertAdapter, IngestedAlert } from "../../types";
import { GrafanaPayloadSchema } from "./api-types";
import { mapPayload } from "./mapper";

export const grafanaAdapter: AlertAdapter = {
  id: "grafana",
  parseBody(raw: string): unknown {
    return JSON.parse(raw);
  },
  groupKey(body: unknown): string | null {
    const payload = GrafanaPayloadSchema.parse(body);
    // Grafana's rule UID is stable across firing/resolved for one rule; the
    // groupKey it sends embeds a timestamp on some versions, so prefer the UID.
    const ruleUid =
      payload.commonLabels.__alert_rule_uid__ ??
      payload.groupLabels.__alert_rule_uid__ ??
      payload.alerts[0]?.labels.__alert_rule_uid__;
    if (ruleUid) return ruleUid;
    if (payload.groupKey) return payload.groupKey;
    const labels = Object.entries(payload.groupLabels).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (labels.length === 0) return null;
    return labels.map(([k, v]) => `${k}=${v}`).join(",");
  },
  formatAlerts(body: unknown): IngestedAlert[] {
    return mapPayload(GrafanaPayloadSchema.parse(body));
  },
};

export * from "./api-types";
export * from "./mapper";
