import type {
  Maintenance,
  StatusBarData,
  StatusReport,
  StatusReportUpdateType,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

const company = {
  name: "Pied Piper",
  slug: "pied-piper",
  domain: "status.piedpiper.dev",
  icon: "/assets/landing/pied-piper.png",
  internalDomain: "internal.piedpiper.dev",
  internalPassword: "pied-piper-internal",
  ipAllowlist: "203.0.113.0/24",
  slackChannel: "#incidents",
  // One enterprise customer, for the shared Slack Connect channel.
  customer: "Hooli",
  // The engineer who declares the incident from Slack.
  oncall: {
    name: "Bertram G.",
    initials: "BG",
    email: "gilfoyle@piedpiper.dev",
  },
} as const;

const components = [
  {
    name: "Checkout API",
    group: "Payments",
    status: "degraded",
    uptime: "99.94%",
    degradedDays: [21],
    incident: true,
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
] as const satisfies {
  name: string;
  group: string;
  status: Exclude<StatusType, "empty">;
  uptime: string;
  external?: boolean;
  /** Degraded bars, as indices from the oldest day; the incident day is added by `getStatusBarData`. */
  degradedDays: number[];
  /** Carries the incident event on `getIncidentDay`. */
  incident?: boolean;
}[];

export type DemoComponent = (typeof components)[number];

const subscribers = { email: 1_204, slackConnect: 3 } as const;
const actor = `${company.oncall.email} · slack`;

/**
 * One fictional company, one incident. Every `<Demo>` on every content page
 * renders a moment of this story so the demos read as a single narrative.
 */
export const demo = {
  company,
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
        time: "09:44",
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
  components,
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
  // One check, phase by phase. The handshake is fine; the edge holds the
  // request before answering 503, so the wait shows up as TTFB.
  timing: {
    region: "lhr",
    phases: [
      { phase: "DNS", ms: 12 },
      { phase: "Connect", ms: 38 },
      { phase: "TLS", ms: 61 },
      { phase: "TTFB", ms: 4_265 },
      { phase: "Transfer", ms: 12 },
    ],
  },
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
  subscribers,
  audit: [
    {
      time: "10:36:00",
      action: "status_report.update",
      detail: "→ resolved",
      actor,
    },
    {
      time: "10:14:03",
      action: "status_report.update",
      detail: "→ monitoring",
      actor,
    },
    {
      time: "09:52:41",
      action: "notification.send",
      detail: `email ${subscribers.email.toLocaleString("en-US")} · rss · slack-connect`,
      actor: "system",
    },
    {
      time: "09:52:40",
      action: "status_report.update",
      detail: "→ identified",
      actor,
    },
    {
      time: "09:44:31",
      action: "notification.send",
      detail: `email ${subscribers.email.toLocaleString("en-US")} · rss · slack-connect`,
      actor: "system",
    },
    {
      time: "09:44:30",
      action: "status_report.create",
      detail: "investigating · Checkout API",
      actor,
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
    apiKey: "••••••••••••••••7f2a",
    counts: [
      { label: "Components", value: components.length },
      { label: "Groups", value: new Set(components.map((c) => c.group)).size },
      { label: "Status Reports", value: 37 },
      { label: "Maintenances", value: 3 },
      { label: "Subscribers", value: subscribers.email },
      {
        label: "Monitors",
        value: components.filter((c) => !("external" in c)).length,
      },
    ],
  },
  privateLocation: {
    image: "ghcr.io/openstatushq/private-location:latest",
    imageSize: "8.5 MB",
    probes: [
      { name: "vpc-eu-west", ip: "10.0.4.12", seen: "2s ago" },
      { name: "office-berlin", ip: "192.168.1.40", seen: "5s ago" },
    ],
  },
} as const;

export const SSH_HOST = "ssh.openstatus.dev";
export const feedUrl = `https://${company.domain}/feed`;
export const sshCommand = `ssh ${company.slug}@${SSH_HOST}`;

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

/** `231 ms` below a second, `4.39 s` above. */
export function formatMs(ms: number) {
  return ms < 1_000 ? `${formatNumber(ms)} ms` : `${(ms / 1_000).toFixed(2)} s`;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Components backed by a monitor; external services are set by hand. */
export function getMonitors() {
  return demo.components.filter((c) => !("external" in c && c.external));
}

export function worstStatus(
  list: readonly { status: DemoComponent["status"] }[],
): DemoComponent["status"] {
  return list.some((c) => c.status === "degraded") ? "degraded" : "success";
}

/** Components grouped in page order, each group carrying its worst status. */
export function getGroups(list: readonly DemoComponent[] = demo.components) {
  return [...new Set(list.map((c) => c.group))].map((name) => {
    const items = list.filter((c) => c.group === name);
    return { name, items, status: worstStatus(items) };
  });
}

/** The audit row every timestamp in a demo has to trace back to. */
export function auditRow(action: string, detail?: string) {
  const row = demo.audit.find(
    (r) => r.action === action && (detail === undefined || r.detail === detail),
  );
  if (!row) throw new Error(`No audit row for ${action} ${detail ?? ""}`);
  return row;
}

/** `HH:MM` of an `HH:MM:SS` audit time. */
export function hhmm(time: string) {
  return time.slice(0, 5);
}

const DAYS = 45;

/** Anchor the incident on the most recent day where its whole timeline is in the past. */
export function getIncidentDay(now = new Date()) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const lastUpdate = demo.incident.updates[demo.incident.updates.length - 1];
  if (now < atTime(day, lastUpdate.time)) day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

/** `HH:MM` or `HH:MM:SS` UTC on the given day. */
export function atTime(day: Date, time: string) {
  const [h, m, s = 0] = time.split(":").map(Number);
  const date = new Date(day);
  date.setUTCHours(h, m, s, 0);
  return date;
}

/** Minutes from the first update to the last. */
export function getIncidentMinutes() {
  const { updates } = demo.incident;
  const day = new Date(0);
  const from = atTime(day, updates[0].time);
  const to = atTime(day, updates[updates.length - 1].time);
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

/** `52m`, `23h 8m`. */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

/** 45 days of bar data ending today. A component with `incident` gets a degraded bar and the event on `getIncidentDay`. */
export function getStatusBarData(
  component: { degradedDays: readonly number[]; incident?: boolean },
  now = new Date(),
): StatusBarData[] {
  const incident = getIncident("resolved", now);
  const incidentDay = getIncidentDay(now);
  const degradedMinutes = getIncidentMinutes();
  return Array.from({ length: DAYS }, (_, i) => {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (DAYS - 1 - i));
    const isIncidentDay =
      component.incident === true && day.getTime() === incidentDay.getTime();
    const degraded = component.degradedDays.includes(i) || isIncidentDay;
    return {
      day: day.toISOString(),
      // The band is exaggerated so a sub-hour incident stays visible at 45-day scale.
      bar: degraded
        ? [
            { status: "success", height: 75 },
            { status: "degraded", height: 25 },
          ]
        : [{ status: "success", height: 100 }],
      card: degraded
        ? [
            {
              status: "success",
              value: formatMinutes(24 * 60 - degradedMinutes),
            },
            { status: "degraded", value: formatMinutes(degradedMinutes) },
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
