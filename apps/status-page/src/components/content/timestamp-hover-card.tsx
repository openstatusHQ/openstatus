import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useMediaQuery } from "@/hooks/use-media-query";
import { UTCDate } from "@date-fns/utc";
import {
  type HoverCardContentProps,
  HoverCardPortal,
} from "@radix-ui/react-hover-card";
import { format } from "date-fns";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

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
            <Row value={formatted} label={timezone} />
            <Row value={utc} label="UTC" />
            {/* <Row value={date.toISOString()} label="ISO" /> */}
            {/* <Row value={String(date.getTime())} label="Timestamp" /> */}
            <Row value={relative} label="Relative" />
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
