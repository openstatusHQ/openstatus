"use client";

import type { RouterOutputs } from "@openstatus/api";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardSkeleton,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import {
  type PingDay,
  formatNextPing,
  getHeartbeatHealth,
  heartbeatExpectedAt,
  heartbeatHealthConfig,
} from "@/data/heartbeat.client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useNow } from "@/hooks/use-now";
import {
  formatDistanceToNowShort,
  formatDurationShort,
  formatNumber,
} from "@/lib/formatter";

type Monitor = NonNullable<RouterOutputs["monitor"]["get"]>;
type Heartbeat = NonNullable<RouterOutputs["monitor"]["heartbeat"]>;

const TICK_MS = 10_000;

function CardTime({
  date,
  children,
}: {
  date: Date;
  children: React.ReactNode;
}) {
  return (
    <HoverCardTimestamp date={date} side="bottom">
      <time
        dateTime={date.toISOString()}
        // focusable so the hover card opens from the keyboard
        tabIndex={0}
        className="focus-visible:ring-ring/50 rounded-sm tabular-nums outline-none focus-visible:ring-[3px]"
      >
        {children}
      </time>
    </HoverCardTimestamp>
  );
}

// owns the clock, so the tick re-renders these cards and not the page
export function HeartbeatSection({
  monitor,
  heartbeat: state,
  isLoading,
  days,
  downtime,
  isWindowLoading,
}: {
  monitor: Monitor;
  heartbeat: Heartbeat | undefined;
  isLoading: boolean;
  days: PingDay[] | undefined;
  /** ms down in the window; undefined until the incidents load */
  downtime: number | undefined;
  isWindowLoading: boolean;
}) {
  const now = useNow(TICK_MS);
  // the server has no clock to share: relative times and "late" wait for hydration
  const hydrated = useHydrated();
  const health = state
    ? getHeartbeatHealth(monitor, state, hydrated ? now : new Date(0))
    : undefined;
  const heartbeat = hydrated ? state : undefined;
  const expectedAt =
    heartbeat && health !== "paused" ? heartbeatExpectedAt(heartbeat) : null;
  const failed = days?.reduce((sum, day) => sum + day.error, 0);

  const metrics: {
    label: string;
    variant: React.ComponentProps<typeof MetricCard>["variant"];
    /** undefined while it loads, or for good when its query failed */
    value: React.ReactNode | undefined;
    isLoading: boolean;
  }[] = [
    {
      label: "STATUS",
      variant: health ? heartbeatHealthConfig[health].variant : "default",
      value: health ? heartbeatHealthConfig[health].label : undefined,
      isLoading,
    },
    {
      label: "LAST PING",
      variant: "default",
      value: !heartbeat ? undefined : heartbeat.lastPingAt ? (
        <CardTime date={heartbeat.lastPingAt}>
          {formatDistanceToNowShort(heartbeat.lastPingAt)}
        </CardTime>
      ) : (
        "—"
      ),
      isLoading: isLoading || !hydrated,
    },
    {
      label: "NEXT PING",
      variant: "default",
      value: !heartbeat ? undefined : expectedAt ? (
        <CardTime date={expectedAt}>{formatNextPing(expectedAt, now)}</CardTime>
      ) : (
        "—"
      ),
      isLoading: isLoading || !hydrated,
    },
    {
      label: "FAILED",
      variant: "destructive",
      value: failed === undefined ? undefined : formatNumber(failed),
      isLoading: isWindowLoading,
    },
    {
      label: "DOWNTIME",
      variant: "default",
      value:
        downtime === undefined
          ? undefined
          : downtime > 0
            ? formatDurationShort(downtime)
            : "None",
      isLoading: isWindowLoading,
    },
  ];

  return (
    <MetricCardGroup>
      {metrics.map((metric) => (
        <MetricCard key={metric.label} variant={metric.variant}>
          <MetricCardHeader>
            <MetricCardTitle className="truncate">
              {metric.label}
            </MetricCardTitle>
          </MetricCardHeader>
          {metric.value !== undefined ? (
            <MetricCardValue>{metric.value}</MetricCardValue>
          ) : metric.isLoading ? (
            <MetricCardSkeleton className="h-6 w-12" />
          ) : (
            <MetricCardValue>—</MetricCardValue>
          )}
        </MetricCard>
      ))}
    </MetricCardGroup>
  );
}
