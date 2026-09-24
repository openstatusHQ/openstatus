import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";

import { Pill } from "@/components/common/pill";
import { cn } from "@/lib/utils";

/** Sorted `[key, value]` pairs with empty values dropped; `[]` for non-objects. */
export function getMetadataEntries(value: unknown): [string, string][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string" && entry[1].trim().length > 0;
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

export function TableCellMetadata({
  value,
  maxEntries,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: unknown;
  /** Collapse the rest into a `+n` chip with the full list in a tooltip. */
  maxEntries?: number;
}) {
  const entries = getMetadataEntries(value);

  if (entries.length === 0) {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        -
      </div>
    );
  }

  const visible = maxEntries ? entries.slice(0, maxEntries) : entries;
  const hidden = maxEntries ? entries.slice(maxEntries) : [];

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      <TooltipProvider>
        {visible.map(([key, val]) => (
          <MetadataPill key={key} label={key} value={val} />
        ))}
        {hidden.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground bg-muted inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium">
                +{hidden.length}
              </span>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col gap-1 font-mono text-xs">
              {hidden.map(([key, val]) => (
                <div key={key}>
                  {key}: {val}
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </TooltipProvider>
    </div>
  );
}

function MetadataPill({ label, value }: { label: string; value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [value]);

  const pill = (
    <Pill
      label={label}
      value={
        <span ref={ref} className="block max-w-32 truncate">
          {value}
        </span>
      }
      variant="outline"
    />
  );

  if (!isTruncated) return pill;

  return (
    <Tooltip>
      <TooltipTrigger onPointerDown={(event) => event.preventDefault()} asChild>
        <div className="inline-flex">{pill}</div>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-xs">
        {label}: {value}
      </TooltipContent>
    </Tooltip>
  );
}
