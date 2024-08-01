import type { Monitor } from "@openstatus/db/src/schema";

export interface StatusDotProps {
  active?: Monitor["active"];
  status?: Monitor["status"];
  maintenance?: boolean;
}

export function StatusDot({ active, status, maintenance }: StatusDotProps) {
  if (!active) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-muted-foreground/80" />
      </span>
    );
  }
  if (maintenance) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-monitoring/80 opacity-75 duration-[2000ms]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-status-monitoring" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-down/80 opacity-75 duration-[2000ms]" />
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-status-down" />
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-degraded/80 opacity-75 duration-[2000ms]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-status-degraded" />
      </span>
    );
  }

  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-operational/80 opacity-75 duration-[2000ms]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-status-operational" />
    </span>
  );
}
