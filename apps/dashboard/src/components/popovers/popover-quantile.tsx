import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { cn } from "@openstatus/ui/lib/utils";

export function PopoverQuantile({
  children,
  className,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "decoration-muted-foreground/70 hover:decoration-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=open]:decoration-foreground dark:aria-invalid:ring-destructive/40 shrink-0 rounded-md p-0 underline decoration-dotted underline-offset-2 transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" className="p-0 text-sm">
        <p className="px-3 py-2 font-medium">
          A quantile represents a specific percentile in your dataset.
        </p>
        <Separator />
        <p className="text-muted-foreground px-3 py-2">
          For example, p50 is the 50th percentile - the point below which 50% of
          data falls. Higher percentiles include more data and highlight the
          upper range.
        </p>
      </PopoverContent>
    </Popover>
  );
}
