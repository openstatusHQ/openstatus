"use client";

import { UTCDate } from "@date-fns/utc";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Copy } from "lucide-react";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

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
          <Row value={String(date.getTime())} label="Timestamp" />
          <Row
            value={format(new UTCDate(date), "LLL dd, y HH:mm:ss")}
            label="UTC"
          />
          <Row value={format(date, "LLL dd, y HH:mm:ss")} label={timezone} />
          <Row
            value={formatDistanceToNowStrict(date, { addSuffix: true })}
            label="Relative"
          />
        </dl>
      </HoverCardContent>
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
        copy(value, {});
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
