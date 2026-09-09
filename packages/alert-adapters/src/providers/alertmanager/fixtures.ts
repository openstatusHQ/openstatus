export const FIRING_GROUP = {
  version: "4",
  groupKey: '{}/{severity="critical"}:{alertname="HighErrorRate"}',
  truncatedAlerts: 0,
  status: "firing",
  receiver: "openstatus",
  groupLabels: { alertname: "HighErrorRate" },
  commonLabels: { alertname: "HighErrorRate", severity: "critical" },
  commonAnnotations: { summary: "Error rate above 5%" },
  externalURL: "http://alertmanager.example.com",
  alerts: [
    {
      status: "firing",
      labels: {
        alertname: "HighErrorRate",
        severity: "critical",
        service: "checkout",
      },
      annotations: {
        summary: "Error rate above 5%",
        description: "checkout is returning 5xx for 3 minutes",
      },
      startsAt: "2026-09-09T10:00:00.000Z",
      endsAt: "0001-01-01T00:00:00Z",
      generatorURL: "http://prometheus.example.com/graph",
      fingerprint: "a1b2c3d4e5f60718",
    },
  ],
};

export const RESOLVED_GROUP = {
  ...FIRING_GROUP,
  status: "resolved",
  alerts: [
    {
      ...FIRING_GROUP.alerts[0],
      status: "resolved",
      endsAt: "2026-09-09T10:12:00.000Z",
    },
  ],
};

export const MULTI_ALERT_GROUP = {
  ...FIRING_GROUP,
  alerts: [
    FIRING_GROUP.alerts[0],
    {
      status: "firing",
      labels: {
        alertname: "HighErrorRate",
        severity: "warning",
        service: "cart",
      },
      annotations: { summary: "Error rate elevated" },
      startsAt: "2026-09-09T10:01:00.000Z",
      endsAt: "0001-01-01T00:00:00Z",
      generatorURL: "http://prometheus.example.com/graph",
      fingerprint: "ffeeddccbbaa9988",
    },
  ],
};

export const NO_GROUP_KEY = {
  status: "firing",
  groupLabels: { alertname: "DiskFull", cluster: "eu-1" },
  alerts: [
    {
      status: "firing",
      labels: { alertname: "DiskFull" },
      annotations: {},
      fingerprint: "1122334455667788",
    },
  ],
};
