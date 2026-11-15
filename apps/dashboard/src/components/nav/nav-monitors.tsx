"use client";

import type { RouterOutputs } from "@openstatus/api";
import { useQuery } from "@tanstack/react-query";

import type { StatusVariant } from "@/components/common/status-dot";
import { useMaintenanceTick } from "@/components/maintenances/use-maintenance-status";
import { NAV } from "@/config/nav";
import {
  type MonitorHealth,
  compareMonitorHealth,
  getMonitorHealth,
  monitorHealthConfig,
} from "@/data/monitors.client";
import { formatClockOrDay, formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { NavGroupButton, NavGroupItem, NavGroupStatus } from "./nav-group";
import {
  NavPeek,
  NavPeekContent,
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
  if (health === "maintenance" && m.maintenance) {
    return `until ${formatClockOrDay(m.maintenance.until, now)}`;
  }
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
  const { data: monitors = [] } = useQuery(trpc.monitor.list.queryOptions());
  useMaintenanceTick(
    monitors.flatMap((m) =>
      m.maintenance
        ? [{ from: m.maintenance.until, to: m.maintenance.until }]
        : [],
    ),
  );
  const now = new Date();

  const rows = [...monitors]
    .sort(compareMonitorHealth)
    .map((m) => ({ m, health: getMonitorHealth(m, now) }));
  const failing = rows.filter(
    (r) => r.health === "error" || r.health === "degraded",
  ).length;
  const paused = rows.filter((r) => r.health === "inactive").length;
  const worst: StatusVariant = rows.some((r) => r.health === "error")
    ? "destructive"
    : failing
      ? "warning"
      : rows.some((r) => r.health === "maintenance")
        ? "info"
        : paused === rows.length
          ? "default"
          : "success";

  return (
    <NavGroupItem>
      <NavPeek>
        <NavPeekTrigger>
          <NavGroupButton item={NAV.monitors} tooltip={false} />
        </NavPeekTrigger>
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
            <NavPeekEmpty>
              {monitors.length ? "No match" : "No monitors yet"}
            </NavPeekEmpty>
          </NavPeekList>
        </NavPeekContent>
      </NavPeek>
      {monitors.length ? (
        <NavGroupStatus
          variant={worst}
          count={failing}
          label={
            failing
              ? `${failing} ${failing === 1 ? "monitor needs" : "monitors need"} attention`
              : paused
                ? `${paused} paused, the rest normal`
                : "All monitors normal"
          }
        />
      ) : null}
    </NavGroupItem>
  );
}
