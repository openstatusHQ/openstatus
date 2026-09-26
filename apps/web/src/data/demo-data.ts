import type {
  Maintenance,
  StatusBarData,
  StatusReport,
  StatusReportUpdateType,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

/**
 * One fictional company, one incident. Every `<Demo>` on every content page
 * renders a moment of this story so the demos read as a single narrative.
 */
export const demo = {
  company: {
    name: "Pied Piper",
    slug: "pied-piper",
    domain: "status.piedpiper.dev",
    icon: "/assets/landing/pied-piper.png",
    internalDomain: "internal.piedpiper.dev",
    ipAllowlist: "203.0.113.0/24",
    // One enterprise customer, for the shared Slack Connect channel.
    customer: "Hooli",
  },
  monitor: {
    name: "Checkout API",
    method: "POST",
    url: "https://api.piedpiper.dev/v1/checkout",
    periodicity: "1m",
    degradedAfter: 1_000,
    timeout: 5_000,
    headers: [
      { key: "authorization", value: "Bearer ••••••••" },
      { key: "content-type", value: "application/json" },
    ],
    assertions: [
      {
        target: "status code",
        comparator: "equals",
        value: "200",
        pass: false,
        got: "503",
      },
      {
        target: "header content-type",
        comparator: "contains",
        value: "json",
        pass: true,
      },
      {
        target: "body",
        comparator: "contains",
        value: '"session_id"',
        pass: false,
      },
    ],
  },
  incident: {
    title: "Elevated errors on Checkout API",
    affected: ["Checkout API"],
    updates: [
      {
        status: "investigating",
        time: "09:41",
        message:
          "We are investigating elevated error rates on the Checkout API from European regions. Payments outside Europe are not affected.",
      },
      {
        status: "identified",
        time: "09:52",
        message:
          "A configuration change in our European edge caused the Checkout API to return 503 for requests routed through Europe. A rollback is in progress.",
      },
      {
        status: "monitoring",
        time: "10:14",
        message:
          "The rollback has completed in eu-west-1 and eu-west-2. Error rates are back to baseline; we are monitoring for the next hour.",
      },
      {
        status: "resolved",
        time: "10:36",
        message:
          "Error rates have stayed at baseline for the last hour. This incident is resolved.",
      },
    ] satisfies {
      status: StatusReportUpdateType;
      time: string;
      message: string;
    }[],
  },
  maintenance: {
    title: "Database upgrade",
    affected: ["Checkout API", "Webhooks"],
    message:
      "We are upgrading the primary database. Expect up to five minutes of elevated latency on checkout and delayed webhook delivery.",
    hoursFromNow: 72,
    durationHours: 2,
  },
  components: [
    {
      name: "Checkout API",
      group: "Payments",
      status: "degraded",
      uptime: "99.94%",
      degradedDays: [21, 44],
    },
    {
      name: "Webhooks",
      group: "Payments",
      status: "success",
      uptime: "99.99%",
      degradedDays: [9],
    },
    {
      name: "Stripe",
      group: "Payments",
      status: "success",
      uptime: "—",
      external: true,
      degradedDays: [],
    },
    {
      name: "Dashboard",
      group: "Platform",
      status: "success",
      uptime: "100%",
      degradedDays: [],
    },
    {
      name: "Docs",
      group: "Platform",
      status: "success",
      uptime: "100%",
      degradedDays: [],
    },
  ] satisfies {
    name: string;
    group: string;
    status: Exclude<StatusType, "empty">;
    uptime: string;
    external?: boolean;
    degradedDays: number[];
  }[],
  // The regions the Checkout API monitor runs from. An alert needs at least half
  // of them to fail the same check; the four European ones do, the failing ones first.
  regions: [
    { code: "lhr", city: "London", cloud: "Fly", ms: 4_388, status: 503 },
    { code: "ams", city: "Amsterdam", cloud: "Fly", ms: 4_102, status: 503 },
    { code: "cdg", city: "Paris", cloud: "Fly", ms: 4_051, status: 503 },
    {
      code: "koyeb_fra",
      city: "Frankfurt",
      cloud: "Koyeb",
      ms: 3_970,
      status: 503,
    },
    { code: "iad", city: "Virginia", cloud: "Fly", ms: 231, status: 200 },
    { code: "sjc", city: "San Jose", cloud: "Fly", ms: 244, status: 200 },
  ],
  // The lhr check, phase by phase. The handshake is fine; the edge holds the
  // request before answering 503, so the wait shows up as TTFB.
  timing: [
    { phase: "DNS", ms: 12 },
    { phase: "Connect", ms: 38 },
    { phase: "TLS", ms: 61 },
    { phase: "TTFB", ms: 4_265 },
    { phase: "Transfer", ms: 12 },
  ],
  channels: [
    { name: "Slack", state: "sent" },
    { name: "PagerDuty", state: "paged" },
    { name: "Email", state: "sent" },
    { name: "Webhook", state: "200" },
    { name: "Discord", state: "off" },
    { name: "Opsgenie", state: "off" },
    { name: "SMS", state: "off" },
    { name: "Teams", state: "off" },
  ],
  subscribers: { email: 1_204, slackConnect: 3 },
  audit: [
    {
      time: "10:36:00",
      action: "status_report.update",
      detail: "→ resolved",
      actor: "gilfoyle@piedpiper.dev · slack",
    },
    {
      time: "10:14:03",
      action: "status_report.update",
      detail: "→ monitoring",
      actor: "gilfoyle@piedpiper.dev · slack",
    },
    {
      time: "09:52:41",
      action: "notification.send",
      detail: "email 1,204 · rss · slack-connect",
      actor: "system",
    },
    {
      time: "09:52:40",
      action: "status_report.create",
      detail: "identified · Checkout API",
      actor: "gilfoyle@piedpiper.dev · slack",
    },
    {
      time: "09:41:12",
      action: "monitor.alert",
      detail: "Checkout API · lhr, ams, cdg, koyeb_fra",
      actor: "probe",
    },
  ],
  // Labels as the status page ships them (apps/status-page/messages/*.json).
  locales: [
    {
      code: "en",
      name: "English",
      systemStatus: {
        success: { long: "All Systems Operational", short: "Operational" },
        degraded: { long: "Degraded Performance", short: "Degraded" },
      },
    },
    {
      code: "de",
      name: "Deutsch",
      systemStatus: {
        success: {
          long: "Alle Systeme betriebsbereit",
          short: "Betriebsbereit",
        },
        degraded: { long: "Eingeschränkte Leistung", short: "Eingeschränkt" },
      },
    },
    {
      code: "fr",
      name: "Français",
      systemStatus: {
        success: {
          long: "Tous les systèmes sont opérationnels",
          short: "Opérationnel",
        },
        degraded: { long: "Performances dégradées", short: "Dégradé" },
      },
    },
    {
      code: "ja",
      name: "日本語",
      systemStatus: {
        success: { long: "全システム正常稼働", short: "正常稼働" },
        degraded: { long: "性能低下", short: "性能低下" },
      },
    },
  ],
  import: {
    provider: "Atlassian Statuspage",
    counts: [
      { label: "Components", value: 4 },
      { label: "Groups", value: 2 },
      { label: "Status Reports", value: 37 },
      { label: "Maintenances", value: 3 },
      { label: "Subscribers", value: 1_204 },
      { label: "Monitors", value: 4 },
    ],
  },
} as const;

const DAYS = 45;

/** Anchor the incident on the most recent day where its whole timeline is in the past. */
export function getIncidentDay(now = new Date()) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const lastUpdate = demo.incident.updates[demo.incident.updates.length - 1];
  if (now < atTime(day, lastUpdate.time)) day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const date = new Date(day);
  date.setUTCHours(h, m, 0, 0);
  return date;
}

/**
 * The incident as a `StatusReport`, optionally cut off after a given update so a
 * demo can show the page mid-incident.
 */
export function getIncident(
  upTo: StatusReportUpdateType = "resolved",
  now = new Date(),
): StatusReport {
  const day = getIncidentDay(now);
  const index = demo.incident.updates.findIndex((u) => u.status === upTo);
  return {
    id: 1,
    title: demo.incident.title,
    affected: [...demo.incident.affected],
    updates: demo.incident.updates.slice(0, index + 1).map((u) => ({
      status: u.status,
      message: u.message,
      date: atTime(day, u.time),
    })),
  };
}

export function getMaintenance(now = new Date()): Maintenance {
  const from = new Date(
    now.getTime() + demo.maintenance.hoursFromNow * 3_600_000,
  );
  from.setUTCMinutes(0, 0, 0);
  return {
    id: 2,
    title: demo.maintenance.title,
    affected: [...demo.maintenance.affected],
    message: demo.maintenance.message,
    from,
    to: new Date(from.getTime() + demo.maintenance.durationHours * 3_600_000),
  };
}

/** 45 days of bar data; `degradedDays` are indices from the oldest day, 44 = today. */
export function getStatusBarData(
  degradedDays: readonly number[],
  now = new Date(),
): StatusBarData[] {
  const incident = getIncident("resolved", now);
  const incidentDay = getIncidentDay(now);
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (DAYS - 1 - i));
    const degraded = degradedDays.includes(i);
    const isIncidentDay = day.getTime() === incidentDay.getTime() && degraded;
    return {
      day: day.toISOString(),
      bar: degraded
        ? [
            { status: "success", height: 75 },
            { status: "degraded", height: 25 },
          ]
        : [{ status: "success", height: 100 }],
      card: degraded
        ? [
            { status: "success", value: "18h" },
            { status: "degraded", value: "6h" },
          ]
        : [{ status: "success", value: "24h" }],
      events: isIncidentDay
        ? [
            {
              id: incident.id,
              name: incident.title,
              type: "report",
              from: incident.updates[0].date,
              to: incident.updates[incident.updates.length - 1].date,
              status: "degraded",
            },
          ]
        : [],
    };
  });
}
