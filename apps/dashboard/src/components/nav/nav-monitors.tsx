"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useQuery } from "@tanstack/react-query";

import type { StatusVariant } from "@/components/common/status-dot";
import { NAV } from "@/config/nav";
import {
  type MonitorHealth,
  compareMonitorHealth,
  getMonitorHealth,
  monitorHealthConfig,
} from "@/data/monitors.client";
import { useNow } from "@/hooks/use-now";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { NavGroupButton, NavGroupItem, NavGroupStatus } from "./nav-group";
import {
  NavPeek,
  NavPeekContent,
  NavPeekCreate,
  NavPeekEmpty,
  NavPeekItem,
  NavPeekItemMeta,
  NavPeekItemTitle,
  NavPeekList,
  NavPeekSearch,
  NavPeekTrigger,
} from "./nav-peek";

type Monitor = RouterOutputs["monitor"]["list"][number];

function healthReason(m: Monitor, health: MonitorHealth, now: Date) {
  if (health === "inactive") return "paused";
  if (health === "error" || health === "degraded") {
    const open = m.incidents.find((i) => !i.resolvedAt);
    const word = health === "error" ? "down" : "degraded";
    return open
      ? `${word} ${formatDurationShort(now.getTime() - new Date(open.startedAt).getTime())}`
      : word;
  }
  return null;
}

/** Sidebar item for monitors: worst status at a glance, the list on hover. */
export function NavMonitorsItem() {
  const trpc = useTRPC();
  const { data: monitors = [], isPending } = useQuery(
    trpc.monitor.list.queryOptions(),
  );
  const now = useNow(60_000);

  const rows = [...monitors]
    .sort(compareMonitorHealth)
    .map((m) => ({ m, health: getMonitorHealth(m) }));
  const failing = rows.filter(
    (r) => r.health === "error" || r.health === "degraded",
  ).length;
  const paused = rows.filter((r) => r.health === "inactive").length;
  const worst: StatusVariant = rows.some((r) => r.health === "error")
    ? "destructive"
    : failing
      ? "warning"
      : paused === rows.length
        ? "default"
        : "success";

  return (
    <NavGroupItem>
      <NavPeek>
        <NavPeekTrigger>
          <NavGroupButton item={NAV.monitors} tooltip={false} />
        </NavPeekTrigger>
        {isPending ? null : monitors.length ? (
          <NavPeekContent label="Monitors">
            <NavPeekSearch placeholder="Search monitors…" />
            <NavPeekList>
              {rows.map(({ m, health }) => {
                const variant = monitorHealthConfig[health].variant;
                const reason = healthReason(m, health, now);
                return (
                  <NavPeekItem
                    key={m.id}
                    // unique even when two monitors share a name
                    value={`${m.name} #${m.id}`}
                    keywords={[m.url, m.jobType, ...m.tags.map((t) => t.name)]}
                    href={`/monitors/${m.id}/overview`}
                    variant={variant}
                  >
                    <NavPeekItemTitle>{m.name}</NavPeekItemTitle>
                    {reason ? (
                      <NavPeekItemMeta variant={variant}>
                        {reason}
                      </NavPeekItemMeta>
                    ) : null}
                  </NavPeekItem>
                );
              })}
              <NavPeekEmpty>No match</NavPeekEmpty>
            </NavPeekList>
          </NavPeekContent>
        ) : (
          <NavPeekContent label="Monitors">
            <NavPeekCreate href="/monitors/create">
              Create monitor
            </NavPeekCreate>
          </NavPeekContent>
        )}
      </NavPeek>
      {monitors.length ? (
        <NavGroupStatus
          variant={worst}
          count={monitors.length}
          label={`${monitors.length} ${monitors.length === 1 ? "monitor" : "monitors"}, ${
            failing
              ? `${failing} ${failing === 1 ? "needs" : "need"} attention`
              : paused
                ? `${paused} paused, the rest normal`
                : "all normal"
          }`}
        />
      ) : null}
    </NavGroupItem>
  );
}
