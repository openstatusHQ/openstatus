type BarStatus = "success" | "degraded" | "error" | "info" | "empty";

type ComponentDay = {
  day: string;
  bar: { status: BarStatus; height: number }[];
};

export type ComponentUptime = {
  type: string;
  uptime: string;
  data: ComponentDay[];
};

export type DayCell = { day: string; status: BarStatus };

const severity: Record<BarStatus, number> = {
  error: 4,
  degraded: 3,
  info: 2,
  success: 1,
  empty: 0,
};

export function aggregatePageDays(components: ComponentUptime[]): DayCell[] {
  const byDay = new Map<string, BarStatus>();
  for (const component of components) {
    for (const { day, bar } of component.data) {
      const key = day.slice(0, 10);
      let worst = byDay.get(key) ?? "empty";
      for (const segment of bar) {
        if (segment.height <= 0) continue;
        if (severity[segment.status] > severity[worst]) worst = segment.status;
      }
      byDay.set(key, worst);
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, status]) => ({ day, status }));
}

type DateLike = Date | string | number;

type ActiveEvents = {
  statusReports?: {
    title: string;
    status: string;
    statusReportUpdates?: { date: DateLike }[];
  }[];
  maintenances?: { title: string; from: DateLike; to: DateLike }[];
  incidents?: {
    startedAt: DateLike | null;
    resolvedAt: DateLike | null;
  }[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// manual UTC formatting — date-fns format() uses the server's local timezone
function formatUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${hh}:${mm} UTC`;
}

export function stateContext(
  variant: string,
  events: ActiveEvents,
  now = new Date(),
): string | null {
  if (variant === "maintenance") {
    const active = events.maintenances?.find(
      (m) =>
        new Date(m.from).getTime() <= now.getTime() &&
        new Date(m.to).getTime() >= now.getTime(),
    );
    return active
      ? `${active.title} · until ${formatUtc(new Date(active.to))}`
      : null;
  }
  if (variant === "degraded") {
    const active = events.statusReports?.find(
      (r) => !["monitoring", "resolved"].includes(r.status),
    );
    if (!active) return null;
    const started = active.statusReportUpdates
      ?.map((u) => new Date(u.date).getTime())
      .sort((a, b) => a - b)[0];
    return started
      ? `${active.title} · started ${formatUtc(new Date(started))}`
      : active.title;
  }
  if (variant === "incident" || variant === "down") {
    const ongoing = events.incidents?.find((i) => i.startedAt && !i.resolvedAt);
    return ongoing?.startedAt
      ? `Ongoing incident · started ${formatUtc(new Date(ongoing.startedAt))}`
      : null;
  }
  return null;
}

// satori fetches the icon server-side during render — restrict to our upload
// storage so a stored URL can't be used as an SSRF primitive, and to raster
// formats since satori renders .svg/.ico as blank boxes
const ALLOWED_ICON_HOSTS = [/\.public\.blob\.vercel-storage\.com$/i];
const RASTER_ICON = /\.(png|jpe?g|webp|gif)$/i;

export function safeIconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null;
  let url: URL;
  try {
    url = new URL(icon);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_ICON_HOSTS.some((host) => host.test(url.hostname))) return null;
  if (!RASTER_ICON.test(url.pathname)) return null;
  return url.toString();
}

export function aggregateUptime(components: ComponentUptime[]): string | null {
  const monitors = components.filter((c) => c.type === "monitor");
  if (monitors.length === 0) return null;
  if (monitors.length === 1) return monitors[0].uptime;
  const values = monitors.map((c) => Number.parseFloat(c.uptime));
  if (values.some((value) => Number.isNaN(value))) return null;
  // average in integer hundredths to avoid float artifacts like 99.97999...
  const cents = values.map((value) => Math.round(value * 100));
  const avg = cents.reduce((sum, value) => sum + value, 0) / cents.length;
  return `${Math.floor(avg) / 100}%`;
}
