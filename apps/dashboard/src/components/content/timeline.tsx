"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { UserAvatar } from "@/components/common/user-avatar";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Two kinds of item share the list: a compact row (`TimelineIndicator` +
 * `TimelineHeader`) for state changes, and a `TimelineCard` for authored
 * content. The indicator and the card's avatar sit on the same column.
 */
export function Timeline({
  children,
  className,
  ...props
}: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="timeline"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      {children}
    </ol>
  );
}

// The rail runs up through the gap to the item above, on the column shared
// by row icons and card avatars; the composer at the head is part of it.
export function TimelineItem({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="timeline-item"
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5",
        "before:bg-border before:absolute before:-top-3.5 before:left-[1.625rem] before:h-3 before:w-px before:-translate-x-1/2",
        "first:before:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </li>
  );
}

// ml-4 matches the card's horizontal padding so the icon lines up with the
// card avatar.
export function TimelineIndicator({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-indicator"
      aria-hidden="true"
      className={cn(
        "text-muted-foreground ml-4 flex size-5 shrink-0 items-center justify-center [&>svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function TimelineCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-card"
      className={cn(
        "bg-card text-card-foreground relative col-span-full flex flex-col rounded-lg border shadow-xs",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// One sentence, muted throughout in a compact row; inside a card it doubles
// as the card header and `TimelineActor`/`TimelineHighlight` lift to the
// foreground.
export function TimelineHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-header"
      className={cn(
        "text-muted-foreground flex min-h-5 min-w-0 flex-wrap items-center gap-y-1 text-sm",
        // compact rows read as one sentence, so the gap is a word space;
        // cards space avatar, badge and time more generously
        "gap-x-1.5 in-data-[slot=timeline-card]:gap-x-2",
        "in-data-[slot=timeline-card]:px-4 in-data-[slot=timeline-card]:pt-3 in-data-[slot=timeline-card]:pb-1.5",
        // room for the pinned actions so the sentence wraps before them
        "has-[>[data-slot=timeline-actions]]:pr-16",
        // compact rows separate the time with a middle dot, once it has rendered
        "[li>&>time:not(:empty)]:before:mr-1.5 [li>&>time:not(:empty)]:before:content-['·']",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TimelineHighlight({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="timeline-highlight"
      className={cn("in-data-[slot=timeline-card]:text-foreground", className)}
      {...props}
    >
      {children}
    </span>
  );
}

type Actor = {
  name: string | null;
  email: string | null;
  photoUrl?: string | null;
};

/** Where the actor acted from, when not the dashboard itself. */
export type ActorSource = {
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  /** Deep link to the original, e.g. a Slack permalink. */
  href?: string;
};

// Renders nothing for a missing actor; the caller phrases the sentence
// without one. Email on hover when the name is shown instead. A source
// overlays the avatar's corner so the sentence keeps its own verb.
export function TimelineActor({
  actor,
  avatar = false,
  source,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  actor: Actor | null;
  avatar?: boolean;
  source?: ActorSource;
}) {
  if (!actor) return null;
  const label = actor.name ?? actor.email ?? "Unknown";
  const name = <span className="truncate">{label}</span>;
  return (
    <span
      data-slot="timeline-actor"
      className={cn(
        "in-data-[slot=timeline-card]:text-foreground inline-flex min-w-0 items-center gap-1.5 in-data-[slot=timeline-card]:font-medium",
        className,
      )}
      {...props}
    >
      {avatar ? (
        <span className="relative shrink-0">
          <UserAvatar name={label} src={actor.photoUrl} className="size-5" />
          {source ? <TimelineActorSource source={source} /> : null}
        </span>
      ) : null}
      {!actor.email || actor.email === label ? (
        name
      ) : (
        <Tooltip>
          <TooltipTrigger
            asChild
            // focusable so the tooltip opens from the keyboard
            tabIndex={0}
            className="focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-[3px]"
          >
            {name}
          </TooltipTrigger>
          <TooltipContent side="top">{actor.email}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

function TimelineActorSource({ source }: { source: ActorSource }) {
  const className = cn(
    "text-foreground absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full ring-1",
    // fill and ring match the surface behind so the badge reads as a cut-out
    "bg-background ring-background in-data-[slot=timeline-card]:bg-card in-data-[slot=timeline-card]:ring-card",
    "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
  );
  // brand icons carry an svg <title>; no pointer events keeps the native tooltip away
  const icon = <source.icon className="pointer-events-none size-2" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {source.href ? (
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open in ${source.label}`}
            className={cn(className, "hover:bg-muted")}
          >
            {icon}
          </a>
        ) : (
          <span
            tabIndex={0}
            aria-label={`via ${source.label}`}
            className={className}
          >
            {icon}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top">
        {source.href ? `Open in ${source.label}` : `via ${source.label}`}
      </TooltipContent>
    </Tooltip>
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
    <HoverCardTimestamp date={date} side="top" align="start">
      <time
        data-slot="timeline-time"
        dateTime={date.toISOString()}
        // focusable so the hover card opens from the keyboard
        tabIndex={0}
        className={cn(
          "text-muted-foreground focus-visible:ring-ring/50 shrink-0 rounded-sm outline-none focus-visible:ring-[3px]",
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

// Pinned to the card corner so a wrapping sentence never pushes it down.
export function TimelineActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-actions"
      className={cn(
        "text-muted-foreground absolute top-2 right-3 flex items-center gap-1 font-mono text-xs",
        className,
      )}
      {...props}
    >
      {children}
    </div>
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
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none px-4 pb-4 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TimelineFooter({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-footer"
      className={cn(
        "bg-muted/30 text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 font-mono text-xs",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
