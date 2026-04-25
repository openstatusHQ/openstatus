"use client";

import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { Check, Copy } from "lucide-react";

export function CopyRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 text-sm",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        copy(value, {});
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 truncate font-mono">
        <span className="invisible group-hover:visible">
          {!isCopied ? (
            <Copy className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
