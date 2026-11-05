"use client";

import { Check, Copy } from "@openstatus/icons";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useMediaQuery } from "@openstatus/ui/hooks/use-media-query";
import {
  type HoverCardContentProps,
  HoverCardPortal,
} from "@radix-ui/react-hover-card";
import { formatDistanceToNowStrict } from "date-fns";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";

import { formatTimestamp } from "../../lib/formatter";
import { useStatusPage } from "../status-page/floating-button";

export function TimestampHoverCard({
  date,
  side = "right",
  align = "start",
  alignOffset = -4,
  sideOffset,
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof HoverCardTrigger> & {
  date: Date;
  side?: HoverCardContentProps["side"];
  align?: HoverCardContentProps["align"];
  alignOffset?: HoverCardContentProps["alignOffset"];
  sideOffset?: HoverCardContentProps["sideOffset"];
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const isTouch = useMediaQuery("(hover: none)");
  const [_, setRerender] = useState(0);

  const { timezone: pageTimezone } = useStatusPage();
  const viewerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // a non-UTC page zone leads, as the visible text is in it; each zone once
  const lead = pageTimezone === "UTC" ? viewerTimezone : pageTimezone;
  const timezones = [...new Set([lead, viewerTimezone, "UTC"])];
  const relative = formatDistanceToNowStrict(date, { addSuffix: true });

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
      {/* NOTE: the trigger is an `a` tag per default */}
      <HoverCardTrigger
        onClick={(e) => {
          // NOTE: support touch devices
          if (isTouch) setOpen((prev) => !prev);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          className="z-10 w-auto p-2"
          {...{ side, align, alignOffset, sideOffset }}
        >
          <dl className="flex flex-col gap-1">
            {timezones.map((timezone) => (
              <Row
                key={timezone}
                value={formatTimestamp(date, timezone, true)}
                label={timezone}
              />
            ))}
            {/* <Row value={date.toISOString()} label="ISO" /> */}
            {/* <Row value={String(date.getTime())} label="Timestamp" /> */}
            <Row value={relative} label={t("Relative")} />
          </dl>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

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
