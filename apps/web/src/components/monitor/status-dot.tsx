import type { Monitor } from "@openstatus/db/src/schema";

export function StatusDot({
  active,
  status,
}: Pick<Monitor, "active" | "status">) {
  if (!active) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-orange-500" />
      </span>
    );
  }

  return status === "active" ? (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/80 opacity-75 duration-1000" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  ) : (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/80 opacity-75 duration-1000" />
      <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}
