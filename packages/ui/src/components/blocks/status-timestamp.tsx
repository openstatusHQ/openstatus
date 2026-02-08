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
