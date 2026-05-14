import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { cn } from "@openstatus/ui/lib/utils";

export type Timing = {
  dns: number;
  connect: number;
  tls: number;
  ttfb: number;
  transfer: number;
};

export function HoverCardTiming({
  timing,
  latency,
}: {
  timing: Timing;
  latency: number;
}) {
  const phasesTotal =
    Object.values(timing).reduce((acc, v) => acc + v, 0) || latency;
  return (
    <HoverCard openDelay={50} closeDelay={50}>
      <HoverCardTrigger
        className="opacity-70 hover:opacity-100 data-[state=open]:opacity-100"
        asChild
      >
        <div className="flex">
          {Object.entries(timing).map(([key, value], index) => (
            <div
              key={key}
              className={cn("h-4")}
              style={{
                width: `${(value / phasesTotal) * 100}%`,
                backgroundColor: `var(--chart-${index + 1})`,
              }}
            />
          ))}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" className="z-10 w-auto p-2">
        <HoverCardTimingContent timing={timing} latency={latency} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function HoverCardTimingContent({
  timing,
  latency,
}: {
  timing: Timing;
  latency: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(timing).map(([key, value], index) => {
        return (
          <div key={key} className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full")}
                style={{ backgroundColor: `var(--chart-${index + 1})` }}
              />
              <div className="font-mono text-accent-foreground uppercase">
                {key}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="font-mono text-muted-foreground">
                {`${new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 2,
                }).format((value / latency) * 100)}%`}
              </div>
              <div className="font-mono">
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 3,
                }).format(value)}
                <span className="text-muted-foreground">ms</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
