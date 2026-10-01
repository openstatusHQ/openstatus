"use client";

import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { formatDistanceToNowStrict } from "date-fns";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { UserAvatar } from "@/components/common/user-avatar";
import { useHydrated } from "@/hooks/use-hydrated";

export function Timeline({
  children,
  className,
  ...props
}: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="timeline"
      className={cn("flex flex-col", className)}
      {...props}
    >
      {children}
    </ol>
  );
}

// The rail is drawn per item, from below its indicator down to the next one.
export function TimelineItem({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="timeline-item"
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 pb-6 last:pb-0",
        "before:bg-border before:absolute before:top-9 before:bottom-1 before:left-4 before:w-px before:-translate-x-1/2 last:before:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </li>
  );
}

const timelineIndicatorVariants = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-full border [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-muted-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info/10 text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function TimelineIndicator({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof timelineIndicatorVariants>) {
  return (
    <div
      data-slot="timeline-indicator"
      aria-hidden="true"
      className={cn(timelineIndicatorVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Same size as the indicator so the rail starts below it.
export function TimelineAvatar({
  className,
  ...props
}: React.ComponentProps<typeof UserAvatar>) {
  return (
    <UserAvatar
      data-slot="timeline-avatar"
      className={cn("size-8 text-xs", className)}
      {...props}
    />
  );
}

// pt-1.5 centers the first text line on the indicator.
export function TimelineContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("flex min-w-0 flex-col gap-1.5 pt-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// The time stays top-right; the title group wraps underneath itself.
export function TimelineHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-header"
      className={cn(
        "flex min-h-5 items-baseline justify-between gap-3 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TimelineTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-title"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TimelineMeta({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-meta"
      className={cn("text-muted-foreground truncate font-normal", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function TimelineTime({
  date,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime"> & { date: Date }) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <HoverCardTimestamp date={date} side="left">
      <time
        data-slot="timeline-time"
        dateTime={date.toISOString()}
        className={cn(
          "text-muted-foreground shrink-0 font-mono text-xs",
          className,
        )}
        {...props}
      >
        {hydrated
          ? (children ?? formatDistanceToNowStrict(date, { addSuffix: true }))
          : null}
      </time>
    </HoverCardTimestamp>
  );
}

export function TimelineBody({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-body"
      className={cn("text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
