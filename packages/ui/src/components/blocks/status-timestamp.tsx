"use client";

import { UTCDate } from "@date-fns/utc";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import type { HoverCardContentProps } from "@radix-ui/react-hover-card";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import { cn } from "@openstatus/ui/lib/utils";

type BaseProps = {
  date: Date;
  variant?: "simple" | "rich";
  className?: string;
};

type SimpleVariantProps = BaseProps &
  React.ComponentProps<typeof TooltipTrigger> & {
    variant?: "simple";
  };

type RichVariantProps = BaseProps &
  React.ComponentProps<typeof HoverCardTrigger> & {
    variant: "rich";
    side?: HoverCardContentProps["side"];
    align?: HoverCardContentProps["align"];
    alignOffset?: HoverCardContentProps["alignOffset"];
    sideOffset?: HoverCardContentProps["sideOffset"];
  };

type StatusTimestampProps = SimpleVariantProps | RichVariantProps;

/**
 * StatusTimestamp - Polymorphic timestamp display component with timezone support
 *
 * A flexible timestamp component that can display dates in two variants:
 * - **simple**: Shows a tooltip on hover with the formatted date (default)
 * - **rich**: Shows a hover card with local timezone, UTC, and relative time, plus copy-to-clipboard
 *
 * The component automatically detects the user's timezone using `Intl.DateTimeFormat()`
 * and displays the date in both the local timezone and UTC. The rich variant includes
 * a live-updating relative time display ("2 minutes ago") that refreshes every second
 * while the hover card is open.
 *
 * Touch device support is built-in for the rich variant, toggling the hover card on tap
 * instead of requiring hover.
 *
 * @param date - The date to display
 * @param variant - Display style: "simple" for tooltip, "rich" for hover card with details
 * @param side - (rich variant only) Placement of the hover card: "top" | "right" | "bottom" | "left"
 * @param align - (rich variant only) Alignment of the hover card: "start" | "center" | "end"
 * @param alignOffset - (rich variant only) Pixel offset for alignment (default: -4)
 * @param sideOffset - (rich variant only) Pixel offset from the trigger
 *
 * @example
 * // Simple variant with tooltip
 * ```tsx
 * <StatusTimestamp date={new Date()} />
 * ```
 *
 * @example
 * // Simple variant with custom children
 * ```tsx
 * <StatusTimestamp date={createdAt}>
 *   Created at
 * </StatusTimestamp>
 * ```
 *
 * @example
 * // Rich variant with hover card showing timezone details
 * ```tsx
 * <StatusTimestamp
 *   date={new Date()}
 *   variant="rich"
 *   side="right"
 * >
 *   2 hours ago
 * </StatusTimestamp>
 * ```
 *
 * @example
 * // Rich variant with custom positioning
 * ```tsx
 * <StatusTimestamp
 *   date={incidentDate}
 *   variant="rich"
 *   side="bottom"
 *   align="start"
 *   alignOffset={0}
 * >
 *   {format(incidentDate, "MMM d, HH:mm")}
 * </StatusTimestamp>
 * ```
 */
export function StatusTimestamp(props: StatusTimestampProps) {
  const { date, variant = "simple", className, ...rest } = props;

  if (variant === "rich") {
    const {
      side = "right",
      align = "start",
      alignOffset = -4,
      sideOffset,
      children,
      onClick,
      ...triggerProps
    } = rest as Omit<RichVariantProps, "date" | "variant" | "className">;

    return (
      <RichTimestamp
        date={date}
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={className}
        onClick={onClick}
        {...triggerProps}
      >
        {children}
      </RichTimestamp>
    );
  }

  const { children, ...triggerProps } = rest as Omit<
    SimpleVariantProps,
    "date" | "variant" | "className"
  >;

  return (
    <SimpleTimestamp date={date} className={className} {...triggerProps}>
      {children}
    </SimpleTimestamp>
  );
}

/**
 * SimpleTimestamp - Internal tooltip-based timestamp display
 *
 * Displays a formatted timestamp with an underlined, dashed decoration and shows
 * the full formatted date in a tooltip on hover. The timestamp is shown in monospace
 * font with muted foreground color.
 *
 * If no children are provided, displays the date in UTC format. If children are
 * provided, they are used as the trigger text while the tooltip still shows the
 * formatted date in the user's local timezone.
 *
 * @param date - The date to display
 * @param children - Optional custom text to display (falls back to formatted UTC date)
 *
 * @example
 * ```tsx
 * <SimpleTimestamp date={new Date()}>
 *   2 hours ago
 * </SimpleTimestamp>
 * ```
 */
function SimpleTimestamp({
  date,
  className,
  children,
  ...props
}: Omit<SimpleVariantProps, "variant">) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "font-mono text-muted-foreground underline decoration-muted-foreground/30 decoration-dashed underline-offset-4",
            className,
          )}
          {...props}
        >
          {children || format(new UTCDate(date), "LLL dd, y HH:mm (z)")}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono">{format(date, "LLL dd, y HH:mm (z)")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * RichTimestamp - Internal hover card timestamp display with timezone details
 *
 * Displays a hover card with comprehensive timestamp information:
 * - Local timezone timestamp with timezone abbreviation (e.g., "PST", "EST")
 * - UTC timestamp
 * - Relative time ("2 hours ago") that updates every second while open
 *
 * Each row in the hover card is clickable to copy the value to clipboard, with
 * a copy icon that appears on hover and changes to a check mark after copying.
 *
 * Touch device support: On touch devices (detected via `(hover: none)` media query),
 * tapping toggles the hover card open/closed instead of requiring hover.
 *
 * The relative time automatically updates every second while the hover card is
 * open, providing live feedback for recent timestamps.
 *
 * @param date - The date to display
 * @param side - Placement of the hover card (default: "right")
 * @param align - Alignment of the hover card (default: "start")
 * @param alignOffset - Pixel offset for alignment (default: -4)
 * @param sideOffset - Pixel offset from the trigger
 * @param children - Custom trigger content
 *
 * @example
 * ```tsx
 * <RichTimestamp
 *   date={new Date()}
 *   side="bottom"
 *   align="center"
 * >
 *   Click for details
 * </RichTimestamp>
 * ```
 */
function RichTimestamp({
  date,
  side = "right",
  align = "start",
  alignOffset = -4,
  sideOffset,
  className,
  children,
  onClick,
  ...props
}: Omit<RichVariantProps, "variant">) {
  const [open, setOpen] = useState(false);
  const isTouch = useMediaQuery("(hover: none)");
  const [_, setRerender] = useState(0);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const relative = formatDistanceToNowStrict(date, { addSuffix: true });
  const formatted = format(date, "LLL dd, y HH:mm:ss");
  const utc = format(new UTCDate(date), "LLL dd, y HH:mm:ss");

  useEffect(() => {
    // only setInterval if open
    if (!open) return;

    const interval = setInterval(() => {
      setRerender((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  return (
    <HoverCard openDelay={0} closeDelay={0} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        className={className}
        onClick={(e) => {
          // NOTE: support touch devices
          if (isTouch) setOpen((prev) => !prev);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        className="z-10 w-auto p-2"
        {...{ side, align, alignOffset, sideOffset }}
      >
        <dl className="flex flex-col gap-1">
          <Row value={formatted} label={timezone} />
          <Row value={utc} label="UTC" />
          <Row value={relative} label="Relative" />
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Row - Internal component for hover card timestamp rows
 *
 * Displays a single row in the rich timestamp hover card with a label (e.g., "UTC")
 * and value (e.g., "Jan 15, 2024 10:30:45"). The entire row is clickable to copy
 * the value to clipboard.
 *
 * The copy icon appears on hover and changes to a check mark after successful copy.
 * A toast notification is shown when the value is copied.
 *
 * @param value - The timestamp string to display and copy
 * @param label - The label for this timestamp (e.g., "UTC", "PST", "Relative")
 */
function Row({ value, label }: { value: string; label: string }) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <div
      className="group flex items-center justify-between gap-4 text-sm"
      onClick={(e) => {
        e.stopPropagation();
        copy(value, { withToast: true });
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 truncate font-mono">
        <span className="invisible group-hover:visible">
          {!isCopied ? (
            <Copy className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </span>
        {value}
      </dd>
    </div>
  );
}
