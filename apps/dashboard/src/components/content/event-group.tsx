import { cn } from "@/lib/utils";

/** A titled slice of a list: `Ongoing 2`, with an optional hint on the right. */
export function EventGroup({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="event-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export function EventGroupHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-group-header"
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

export function EventGroupTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="event-group-title"
      className={cn("flex items-center gap-2 text-sm font-medium", className)}
      {...props}
    />
  );
}

export function EventGroupCount({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="event-group-count"
      className={cn(
        "bg-muted text-muted-foreground rounded-full px-1.5 py-px font-mono text-xs font-normal tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function EventGroupHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="event-group-hint"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}
