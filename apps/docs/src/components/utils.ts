export type Status =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance"
  | "unknown"
  | "incident";

type StatusResponse = { status: Status };

export const statusDictionary: Record<
  Status,
  { label: string; color: string }
> = {
  operational: {
    label: "Operational",
    color: "bg-green-500",
  },
  degraded_performance: {
    label: "Degraded Performance",
    color: "bg-yellow-500",
  },
  partial_outage: {
    label: "Partial Outage",
    color: "bg-yellow-500",
  },
  major_outage: {
    label: "Major Outage",
    color: "bg-red-500",
  },
  unknown: {
    label: "Unknown",
    color: "bg-gray-500",
  },
  incident: {
    label: "Incident",
    color: "bg-yellow-500",
  },
  under_maintenance: {
    label: "Under Maintenance",
    color: "bg-blue-500",
  },
} as const;

export async function getStatus(slug: string): Promise<StatusResponse> {
  const res = await fetch(`https://api.openstatus.dev/public/status/${slug}`);

  if (res.ok) {
    const data = (await res.json()) as StatusResponse;
    return data;
  }

  return { status: "unknown" };
}
