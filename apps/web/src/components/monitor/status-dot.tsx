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
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-orange-500" />
      </span>
    );
  }
  if (maintenance) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/80 opacity-75 duration-[2000ms]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/80 opacity-75 duration-[2000ms]" />
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-500/80 opacity-75 duration-[2000ms]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
      </span>
    );
  }

  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/80 opacity-75 duration-[2000ms]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}
