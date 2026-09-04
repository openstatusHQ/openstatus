import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";

import { cn } from "@/lib/utils";

const variants = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

export function TableCellIndicator({
  variant = "muted",
  label,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: keyof typeof variants;
  label: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("flex items-center justify-center", className)}
            {...props}
          >
            <div
              className={cn("size-2.5 rounded-full", variants[variant])}
              aria-label={label}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
