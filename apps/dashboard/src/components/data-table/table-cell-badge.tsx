import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export function TableCellBadge({
  value,
  className,
  ...props
}: React.ComponentProps<typeof Badge> & { value: unknown }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [ref]);

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono max-w-16 truncate",
        value ? "text-foreground" : "text-foreground/70",
        className
      )}
      {...props}
    >
      <TooltipProvider>
        {isTruncated ? (
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
              onClick={(event) => event.preventDefault()}
              onPointerDown={(event) => event.preventDefault()}
              asChild
            >
              <span ref={ref} className="block truncate">
                {String(value)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{String(value)}</TooltipContent>
          </Tooltip>
        ) : (
          <span ref={ref} className="truncate">
            {String(value)}
          </span>
        )}
      </TooltipProvider>
    </Badge>
  );
}
