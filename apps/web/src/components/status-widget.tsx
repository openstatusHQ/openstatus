import * as z from "zod";

const statusEnum = z.enum([
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "unknown",
]);

const statusSchema = z.object({ status: statusEnum });

const dictionary = {
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
} as const;

export async function StatusWidget({ slug }: { slug: string }) {
  const res = await fetch(`https://api.openstatus.dev/public/status/${slug}`, {
    next: { revalidate: 60 }, // cache request for 60 seconds
  });
  const data = await res.json();
  const parsed = statusSchema.safeParse(data);

  let label = "Unknown";
  let color = "bg-gray-500";

  if (parsed.success) {
    const status = dictionary[parsed.data.status];
    label = status.label;
    color = status.color;
  }

  return (
    <a
      className="border-border text-foreground/70 hover:bg-muted hover:text-foreground inline-flex max-w-fit items-center gap-2 rounded-md border px-3 py-1 text-sm"
      href={`https://${slug}.openstatus.dev`}
      target="_blank"
      rel="noreferrer"
    >
      {label}
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
    </a>
  );
}
