import { EmptyStateContainer } from "@/components/content/empty-state";
import { cn } from "@/lib/utils";

/**
 * A titled slice of a list: `Ongoing 2`, with an optional hint on the right.
 * Without rows it shows its `EventGroupEmpty`, or hides when it has none.
 */
export function EventGroup({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="event-group"
      className={cn(
        "flex flex-col gap-2",
        "not-has-[[data-slot=event-row]]:not-has-[[data-slot=event-group-empty]]:hidden",
        "[&:has([data-slot=event-row])>[data-slot=event-group-empty]]:hidden",
        // a list holding only its "show more" button
        "[&:not(:has([data-slot=event-row]))>[data-slot=event-list]]:hidden",
        className,
      )}
      {...props}
    />
  );
}

/** Shown in place of the list while the group has no rows; one row tall, so empty groups stay out of the way. */
export function EventGroupEmpty({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="event-group-empty" className={className} {...props}>
      {/* a one-row list: row min height plus the list's two borders */}
      <EmptyStateContainer
        inline
        className="min-h-11.5 justify-start px-3 py-2.5"
      >
        {children}
      </EmptyStateContainer>
    </div>
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
