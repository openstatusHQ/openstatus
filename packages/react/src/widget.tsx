import { statusDictionary } from "./utils";

type Status =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance"
  | "unknown";

type StatusResponse = { status: Status };

type StatusWidgetProps = {
  slug: string;
  href?: string;
};

export async function StatusWidget({ slug, href }: StatusWidgetProps) {
  const res = await fetch(`https://api.openstatus.dev/public/status/${slug}`, {
    cache: "no-cache",
  });

  const data = (await res.json()) as StatusResponse;

  const key = data.status;
  const { label, color } = statusDictionary[key];

  return (
    <a
      className="inline-flex max-w-fit items-center gap-2 rounded-md border border-gray-50 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 hover:text-black"
      href={href || `https://${slug}.openstatus.dev`}
      target="_blank"
      rel="noreferrer"
    >
      {label}
      <span className="relative flex h-2 w-2">
        {data.status === "operational" ? (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75 duration-1000`}
          />
        ) : null}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${color}`}
        />
      </span>
    </a>
  );
}
