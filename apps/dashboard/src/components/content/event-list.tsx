"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Slot } from "@radix-ui/react-slot";
import { formatDistanceToNowStrict } from "date-fns";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * Incidents, reports, maintenances and downtime as one row shape: a title
 * over a muted sentence. Groups (active, a month) stack under a title.
 */
export function EventListGroups({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list-groups"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function EventListGroup({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="event-list-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function EventListGroupTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="event-list-group-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function EventList({
  children,
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="event-list"
      className={cn(
        "bg-card text-card-foreground divide-y overflow-hidden rounded-lg border",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

// The title's link is stretched over the row; time, actions and inline links
// sit above it so they stay hoverable and clickable on their own.
export function EventListItem({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="event-list-item"
      className={cn(
        "relative flex flex-wrap items-start gap-x-2.5 gap-y-2 px-4 py-3 sm:flex-nowrap",
        "has-[[data-slot=event-list-title]:focus-visible]:bg-muted/50 hover:bg-muted/50 transition-colors duration-150 ease-[ease]",
        className,
      )}
      {...props}
    >
      {children}
    </li>
  );
}

// Fixed width so titles line up whether a row leads with bars or a date tile;
// 46px is title + gap + first sentence line, so either centres on those two
// lines and stays at the top when the sentence wraps.
export function EventListMedia({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list-media"
      className={cn(
        "flex h-11.5 w-8 shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EventListContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list-content"
      className={cn(
        // below sm the content fills the line beside the media, so actions wrap under it
        "flex min-w-0 flex-1 basis-[calc(100%-2.625rem)] flex-col gap-1.5 sm:basis-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Pass a link with `asChild`; it then covers the whole row. */
export function EventListTitle({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"span"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="event-list-title"
      className={cn(
        "text-foreground min-w-0 text-sm font-medium break-words outline-none",
        "[a&]:hover:decoration-muted-foreground/50 [a&]:after:absolute [a&]:after:inset-0 [a&]:hover:underline [a&]:hover:decoration-dashed [a&]:hover:underline-offset-2",
        className,
      )}
      {...props}
    />
  );
}

// One sentence: each child is a clause, joined by a middle dot.
export function EventListDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list-description"
      className={cn(
        "text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm",
        "[&>*:not(:first-child)]:before:text-muted-foreground [&>*:not(:first-child)]:before:mr-1.5 [&>*:not(:first-child)]:before:content-['·']",
        // a badge's own gap already spaces its dot from the separator
        "[&>[data-slot=badge]]:before:mr-0",
        "[&_a]:relative [&_a]:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EventListTime({
  date,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime"> & { date: Date }) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <HoverCardTimestamp date={date} side="left" align="start">
      <time
        data-slot="event-list-time"
        dateTime={date.toISOString()}
        // focusable so the hover card opens from the keyboard
        tabIndex={0}
        className={cn(
          "focus-visible:ring-ring/50 relative z-10 rounded-sm whitespace-nowrap outline-none focus-visible:ring-[3px]",
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

// Wrapped below sm, ml-10.5 (media + gap) lines actions up with the text;
// beside the title, -my-1 keeps a 28px button from growing the row.
export function EventListActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-list-actions"
      className={cn(
        "relative z-10 ml-10.5 flex shrink-0 items-center gap-1 sm:-my-1 sm:ml-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EventListMore({
  children = "Show more",
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="event-list-more"
      variant="outline"
      size="sm"
      className={cn("self-center", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
