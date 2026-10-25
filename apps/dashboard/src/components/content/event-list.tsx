"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { Link } from "@/components/common/link";
import { UserAvatar } from "@/components/common/user-avatar";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatEventDate } from "@/lib/formatter";
import { cn } from "@/lib/utils";

/**
 * Rows of events in a bordered list. A row is one line when the list is wide
 * enough (date, status, title + meta, quick actions, actor, duration, menu)
 * and folds to two below that: title above; status, date, meta and duration
 * below. Quick actions hide when folded, the menu carries them. The switch is
 * a container query on the list, so a sidebar narrowing the page folds it too.
 */
export function EventList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="event-list"
      className={cn(
        "bg-card text-card-foreground @container divide-y rounded-lg border",
        className,
      )}
      {...props}
    />
  );
}

/** Last row: a full-width button that reveals more. */
export function EventListMore({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <li data-slot="event-list-more">
      <button
        type="button"
        className={cn(
          "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-full rounded-b-lg px-3 py-2 text-center text-sm outline-none focus-visible:ring-[3px]",
          className,
        )}
        {...props}
      />
    </li>
  );
}

export function EventRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="event-row"
      className={cn(
        "group/row relative grid items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm",
        // folded: actor and menu sit on the title line, the duration under them
        "grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] [grid-template-areas:'title_title_title_actor_menu'_'status_date_meta_duration_duration']",
        // fixed duration column so avatars line up across rows ("10d 15h" fits)
        "@3xl:grid-cols-[5.5rem_7.5rem_minmax(0,1fr)_auto_auto_4rem_auto] @3xl:[grid-template-areas:'date_status_content_actions_actor_duration_menu']",
        className,
      )}
      {...props}
    />
  );
}

export function EventRowDate({
  date,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime" | "children"> & {
  date: Date;
}) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <HoverCardTimestamp date={date} side="top" align="start">
      <time
        data-slot="event-row-date"
        dateTime={date.toISOString()}
        // focusable so the hover card opens from the keyboard
        tabIndex={0}
        className={cn(
          "text-muted-foreground focus-visible:ring-ring/50 relative z-10 rounded-sm font-mono text-xs whitespace-nowrap tabular-nums outline-none focus-visible:ring-[3px]",
          "[grid-area:date]",
          className,
        )}
        {...props}
      >
        {hydrated ? formatEventDate(date) : null}
      </time>
    </HoverCardTimestamp>
  );
}

/** Indicator plus a short label: `● SCHEDULED`, `▮▮▮ MAJOR OUTAGE`. */
export function EventRowStatus({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-row-status"
      className={cn(
        "text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs uppercase",
        // one line; a long label like "degraded performance" truncates
        "[&>span:last-child]:truncate",
        "[grid-area:status]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// `contents` in a narrow list hands title and meta to the row grid; from
// `@3xl` it is the one flex cell holding both.
export function EventRowContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-row-content"
      className={cn(
        "contents @3xl:relative @3xl:flex @3xl:min-w-0 @3xl:items-baseline @3xl:gap-x-2 @3xl:[grid-area:content]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The row's title, linked when `href` is given. Blank text still renders the
 * link, with `empty` muted inside it, so the row can always be opened. The
 * link stretches over its content cell (the whole row when folded).
 */
export function EventRowTitle({
  href,
  empty = "No title",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"p">, "children"> & {
  href?: string;
  empty?: string;
  children: string;
}) {
  const blank = children.trim() === "";
  const text = blank ? (
    <span className="text-muted-foreground/50 font-normal">{empty}</span>
  ) : (
    children
  );
  return (
    <p
      data-slot="event-row-title"
      className={cn(
        "text-foreground min-w-0 truncate font-medium",
        "[grid-area:title]",
        className,
      )}
      {...props}
    >
      {href ? (
        <Link href={href} className="after:absolute after:inset-0">
          {text}
        </Link>
      ) : (
        text
      )}
    </p>
  );
}

/** Mono details; children are spans separated by a dot. Folded, it follows the date, so it leads with one too. */
export function EventRowMeta({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  // local times and `now`-relative text differ between server and browser
  const hydrated = useHydrated();
  return (
    <p
      data-slot="event-row-meta"
      className={cn(
        "text-muted-foreground min-w-0 truncate font-mono text-xs",
        "[&>*+*]:before:mx-1.5 [&>*+*]:before:content-['·']",
        "not-empty:before:mr-1.5 not-empty:before:content-['·'] @3xl:not-empty:before:content-none",
        "[grid-area:meta]",
        className,
      )}
      {...props}
    >
      {hydrated ? children : null}
    </p>
  );
}

/** Quick actions, wide lists only; the menu carries the same when folded. */
export function EventRowActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-row-actions"
      className={cn(
        "relative z-10 hidden items-center gap-1.5 @3xl:flex",
        "[grid-area:actions]",
        className,
      )}
      {...props}
    />
  );
}

type Actor = {
  name: string | null;
  email?: string | null;
  photoUrl?: string | null;
};

/**
 * Avatar of who holds the row's role (`label`). Nobody is a dashed ring,
 * unless the role is `optional`: then the slot just stays empty.
 */
export function EventRowActor({
  actor,
  label,
  optional = false,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  actor: Actor | null;
  label: string;
  optional?: boolean;
}) {
  const name = actor ? (actor.name ?? actor.email ?? "Unknown") : null;
  if (!actor && optional) {
    return <span data-slot="event-row-actor" className="[grid-area:actor]" />;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot="event-row-actor"
          tabIndex={0}
          className={cn(
            "focus-visible:ring-ring/50 relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]",
            !actor && "border-muted-foreground/50 border border-dashed",
            "[grid-area:actor]",
            className,
          )}
          {...props}
        >
          {actor ? (
            <UserAvatar
              name={name}
              src={actor.photoUrl}
              className="size-6 text-xs"
            />
          ) : null}
          <span className="sr-only">
            {name ? `${label}: ${name}` : `No ${label.toLowerCase()}`}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {name ? `${label}: ${name}` : `No ${label.toLowerCase()}`}
      </TooltipContent>
    </Tooltip>
  );
}

export function EventRowDuration({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  // open spans run until `now`, which moves between server and browser
  const hydrated = useHydrated();
  return (
    <span
      data-slot="event-row-duration"
      className={cn(
        "text-muted-foreground min-w-10 text-right font-mono text-xs whitespace-nowrap tabular-nums",
        "[grid-area:duration]",
        className,
      )}
      {...props}
    >
      {hydrated ? children : null}
    </span>
  );
}

export function EventRowMenu({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="event-row-menu"
      className={cn(
        "relative z-10 -my-1 flex justify-end",
        "[grid-area:menu]",
        className,
      )}
      {...props}
    />
  );
}
