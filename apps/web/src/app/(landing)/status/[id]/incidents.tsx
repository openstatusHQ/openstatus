import { z } from "zod";

import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "@/app/(landing)/content-box";
import { components } from "@/content/mdx";

const atlassianIncidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string().optional(),
  shortlink: z.string().optional(),
  started_at: z.string().optional(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
});

const atlassianIncidentsResponseSchema = z.object({
  incidents: z.array(atlassianIncidentSchema),
});

type Incident = z.infer<typeof atlassianIncidentSchema>;

const TIMEOUT_MS = 5000;
const MAX_INCIDENTS = 5;

function impactClass(impact: string | undefined): string {
  switch (impact) {
    case "critical":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "major":
      return "bg-destructive/15 text-destructive border-destructive/20";
    case "minor":
      return "bg-warning/15 text-warning border-warning/30";
    case "maintenance":
      return "bg-info/15 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function fetchIncidents(
  statusPageUrl: string,
): Promise<Incident[] | null> {
  const url = `${statusPageUrl}/api/v2/incidents.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.warn(
        `[external-status incidents] non-200 from ${url}: ${res.status}`,
      );
      return null;
    }
    const json = await res.json();
    const parsed = atlassianIncidentsResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `[external-status incidents] invalid payload from ${url}`,
        parsed.error.issues,
      );
      return null;
    }
    return parsed.data.incidents.slice(0, MAX_INCIDENTS);
  } catch (err) {
    console.warn(
      `[external-status incidents] fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type IncidentsProps = {
  statusPageUrl: string;
  apiConfigType?: string;
};

export async function Incidents({
  statusPageUrl,
  apiConfigType,
}: IncidentsProps) {
  if (apiConfigType !== "atlassian") return null;
  const incidents = await fetchIncidents(statusPageUrl);
  if (!incidents) return null;

  if (incidents.length === 0) {
    return (
      <section>
        <h2>Recent incidents</h2>
        <p className="text-muted-foreground">No incidents reported.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Recent incidents</h2>
      <components.Grid cols={1} className="not-prose">
        {incidents.map((inc) => {
          const started = formatTimestamp(inc.started_at ?? inc.created_at);
          const resolved = formatTimestamp(inc.resolved_at ?? null);
          const link = inc.shortlink ?? `${statusPageUrl}/incidents/${inc.id}`;
          return (
            <ContentBoxLink
              key={inc.id}
              href={link}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-3">
                <ContentBoxTitle className="m-0!">{inc.name}</ContentBoxTitle>
                <span
                  className={`inline-flex items-center rounded-none border px-2.5 py-0.5 font-medium text-xs ${impactClass(inc.impact)}`}
                >
                  {inc.impact === "none"
                    ? "incident"
                    : inc.impact ?? "incident"}
                </span>
              </div>
              <ContentBoxDescription className="m-0! text-sm">
                {started ? <>Started {started}</> : null}
                {started && resolved ? " · " : null}
                {resolved ? <>Resolved {resolved}</> : null}
              </ContentBoxDescription>
            </ContentBoxLink>
          );
        })}
      </components.Grid>
    </section>
  );
}
