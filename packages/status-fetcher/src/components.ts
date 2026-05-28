import { Effect } from "effect";
import { z } from "zod";
import { type FetchError, fetchJson } from "./fetch";
import type {
  NormalizedComponent,
  SeverityLevel,
  StatusPageEntry,
  StatusType,
} from "./types";

export const atlassianComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  description: z.string().nullable().optional(),
  position: z.number().optional(),
  group: z.boolean().optional(),
  group_id: z.string().nullable().optional(),
});

export const atlassianComponentsResponseSchema = z.object({
  components: z.array(atlassianComponentSchema),
});

export type AtlassianComponent = z.infer<typeof atlassianComponentSchema>;

const STATUS_MAP: Record<
  string,
  { severity: SeverityLevel; status: StatusType }
> = {
  operational: { severity: "none", status: "operational" },
  degraded_performance: { severity: "minor", status: "degraded" },
  partial_outage: { severity: "major", status: "partial_outage" },
  major_outage: { severity: "critical", status: "major_outage" },
  under_maintenance: { severity: "none", status: "under_maintenance" },
};

function mapStatus(raw: string): {
  severity: SeverityLevel;
  status: StatusType;
} {
  return STATUS_MAP[raw] ?? { severity: "none", status: "operational" };
}

function normalizeAtlassianComponents(
  components: AtlassianComponent[],
): NormalizedComponent[] {
  const groupNameById = new Map<string, string>();
  for (const c of components) {
    if (c.group) groupNameById.set(c.id, c.name);
  }

  const out: NormalizedComponent[] = [];
  for (const c of components) {
    // Group containers become section headers in the UI, not rows.
    if (c.group) continue;
    const { severity, status } = mapStatus(c.status);
    out.push({
      upstreamComponentId: c.id,
      name: c.name,
      description: c.description ?? undefined,
      groupName: c.group_id ? groupNameById.get(c.group_id) : undefined,
      position: c.position ?? 0,
      severity,
      status,
    });
  }
  return out;
}

export const fetchAtlassianCompatibleComponents = (args: {
  entry: StatusPageEntry;
  fetcherName: string;
}): Effect.Effect<NormalizedComponent[], FetchError> => {
  const { entry, fetcherName } = args;
  // `api_config.endpoint` overrides the summary URL only; components always come
  // from the standard `/api/v2/components.json` path under status_page_url.
  const url = `${entry.status_page_url}/api/v2/components.json`;
  return fetchJson({
    url,
    schema: atlassianComponentsResponseSchema,
    fetcherName,
    entryId: entry.id,
  }).pipe(Effect.map((data) => normalizeAtlassianComponents(data.components)));
};
