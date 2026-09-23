import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";

import { Pill } from "@/components/common/pill";

export interface PrivateLocationMetadataProps {
  metadata?: Record<string, string> | null;
  className?: string;
  maxEntries?: number;
  emptyFallback?: "dash" | "none";
}

export function getPrivateLocationMetadataKeywords(
  metadata?: Record<string, string> | null,
): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  return Object.entries(metadata)
    .filter(([_, val]) => typeof val === "string" && val.trim().length > 0)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .flat();
}

export function PrivateLocationMetadata({
  metadata,
  className,
  maxEntries,
  emptyFallback = "none",
}: PrivateLocationMetadataProps) {
  if (!metadata || typeof metadata !== "object") {
    if (emptyFallback === "dash") {
      return <span className="text-muted-foreground font-mono">—</span>;
    }
    return null;
  }

  const entries = Object.entries(metadata)
    .filter(([_, val]) => typeof val === "string" && val.trim().length > 0)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  if (entries.length === 0) {
    if (emptyFallback === "dash") {
      return <span className="text-muted-foreground font-mono">—</span>;
    }
    return null;
  }

  const visibleEntries =
    maxEntries !== undefined ? entries.slice(0, maxEntries) : entries;
  const remainingCount =
    maxEntries !== undefined ? Math.max(0, entries.length - maxEntries) : 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibleEntries.map(([key, value]) => {
        const isLong = value.length > 20;
        const displayValue = isLong ? `${value.slice(0, 18)}…` : value;
        const pillElement = (
          <Pill
            key={key}
            label={key}
            value={displayValue}
            variant="outline"
            className="max-w-[200px]"
          />
        );

        if (isLong) {
          return (
            <TooltipProvider key={key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{pillElement}</span>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">
                  {key}: {value}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return pillElement;
      })}
      {remainingCount > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground bg-muted inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium">
                +{remainingCount}
              </span>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col gap-1 font-mono text-xs">
              {entries.slice(maxEntries).map(([k, v]) => (
                <div key={k}>
                  {k}: {v}
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
