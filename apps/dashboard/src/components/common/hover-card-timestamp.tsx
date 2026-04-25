"use client";

import { UTCDate } from "@date-fns/utc";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { format, formatDistanceToNowStrict } from "date-fns";
import type { ComponentPropsWithoutRef } from "react";
import { CopyRow } from "./copy-row";

// TODO: move to TableCellDate?

type HoverCardContentProps = ComponentPropsWithoutRef<typeof HoverCardContent>;

interface HoverCardTimestampProps {
  date: Date;
  side?: HoverCardContentProps["side"];
  sideOffset?: HoverCardContentProps["sideOffset"];
  align?: HoverCardContentProps["align"];
  alignOffset?: HoverCardContentProps["alignOffset"];
  children?: React.ReactNode;
}

export function HoverCardTimestamp({
  date,
  side = "right",
  align = "start",
  alignOffset = -4,
  sideOffset,
  children,
}: HoverCardTimestampProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        className="z-10 w-auto p-2"
        {...{ side, align, alignOffset, sideOffset }}
      >
        <dl className="flex flex-col gap-1">
          <CopyRow value={String(date.getTime())} label="Timestamp" />
          <CopyRow
            value={format(new UTCDate(date), "LLL dd, y HH:mm:ss")}
            label="UTC"
          />
          <CopyRow
            value={format(date, "LLL dd, y HH:mm:ss")}
            label={timezone}
          />
          <CopyRow
            value={formatDistanceToNowStrict(date, { addSuffix: true })}
            label="Relative"
          />
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
