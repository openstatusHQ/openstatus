import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { cn } from "@openstatus/ui/lib/utils";

export function PopoverResolution({
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
          Run data aggregation on fixed time boundaries.
        </p>
        <Separator />
        <p className="text-muted-foreground px-3 py-2">
          A 30-minute resolution aligns to the top or bottom of the hour (e.g.,
          00:00, 00:30) so all intervals are consistent for analysis.
        </p>
      </PopoverContent>
    </Popover>
  );
}
