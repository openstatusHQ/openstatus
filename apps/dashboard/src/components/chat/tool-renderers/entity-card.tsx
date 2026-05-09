import { cn } from "@openstatus/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function EntityCard({
  icon: Icon,
  title,
  meta,
  right,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border bg-background p-3",
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate font-medium text-sm">{title}</div>
        {meta ? (
          <div className="truncate text-muted-foreground text-xs">{meta}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
