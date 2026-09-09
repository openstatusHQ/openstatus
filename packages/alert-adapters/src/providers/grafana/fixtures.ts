export const FIRING_RULE = {
  receiver: "openstatus",
  status: "firing",
  orgId: 1,
  alerts: [
    {
      status: "firing",
      labels: {
        alertname: "Latency p99",
        grafana_folder: "Prod",
        severity: "warning",
        __alert_rule_uid__: "ae5nxpzt2gowwd",
      },
      annotations: {
        summary: "p99 latency above 1s",
        description: "api p99 is 1.4s",
      },
      startsAt: "2026-09-09T11:00:00.000Z",
      endsAt: "0001-01-01T00:00:00Z",
      generatorURL:
        "https://grafana.example.com/alerting/grafana/ae5nxpzt2gowwd/view",
      fingerprint: "9f8e7d6c5b4a3021",
      dashboardURL: "https://grafana.example.com/d/abc",
      panelURL: "https://grafana.example.com/d/abc?viewPanel=2",
      valueString: "[ var='B' labels={} value=1.4 ]",
    },
  ],
  groupLabels: { alertname: "Latency p99" },
  commonLabels: {
    alertname: "Latency p99",
    severity: "warning",
    __alert_rule_uid__: "ae5nxpzt2gowwd",
  },
  commonAnnotations: { summary: "p99 latency above 1s" },
  externalURL: "https://grafana.example.com/",
  version: "1",
  groupKey: '{}/{}:{alertname="Latency p99"}',
  truncatedAlerts: 0,
  title: "[FIRING:1] Latency p99",
  state: "alerting",
  message: "**Firing**",
};

export const RESOLVED_RULE = {
  ...FIRING_RULE,
  status: "resolved",
  state: "ok",
  title: "[RESOLVED] Latency p99",
  alerts: [
    {
      ...FIRING_RULE.alerts[0],
      status: "resolved",
      endsAt: "2026-09-09T11:20:00.000Z",
    },
  ],
};

export const NO_RULE_UID = {
  status: "firing",
  groupLabels: { alertname: "Legacy" },
  alerts: [
    {
      status: "firing",
      labels: { alertname: "Legacy" },
      annotations: {},
    },
  ],
};
