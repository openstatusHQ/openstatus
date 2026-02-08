/**
 * OpenStatus Registry Example
 *
 * This file demonstrates how to compose status page components together
 * to create a complete status page. It serves as a reference implementation
 * for users installing components via the shadcn CLI.
 *
 * Components used:
 * - Status, StatusHeader, StatusTitle, StatusDescription, StatusContent (layout)
 * - StatusBanner (system status indicator)
 * - StatusBar (45-day uptime visualization)
 * - StatusComponent block components (clean monitor composition)
 * - StatusComponentGroup (collapsible group container)
 * - StatusFeed (incidents and maintenance timeline)
 */

import { StatusBanner } from "@openstatus/ui/components/blocks/status-banner";
import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusComponentGroup } from "@openstatus/ui/components/blocks/status-component-group";
import { StatusFeed } from "@openstatus/ui/components/blocks/status-feed";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@openstatus/ui/components/blocks/status-layout";
import type {
  Maintenance,
  StatusBarData,
  StatusReport,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";
import { Separator } from "@openstatus/ui/components/ui/separator";

/**
 * Generates realistic mock uptime data for the last 45 days
 * Simulates ~98% uptime with occasional degraded periods
 */
function generateMockUptimeData(): StatusBarData[] {
  const data: StatusBarData[] = [];
  const now = new Date();

  for (let i = 44; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    // Generate random status with high success rate
    const rand = Math.random();
    let bar: { status: StatusType; height: number }[];

    if (rand < 0.02) {
      // 2% chance of error day - partial outage
      bar = [
        { status: "success", height: 70 },
        { status: "error", height: 30 },
      ];
    } else if (rand < 0.05) {
      // 3% chance of degraded day
      bar = [
        { status: "success", height: 85 },
        { status: "degraded", height: 15 },
      ];
    } else if (rand < 0.08) {
      // 3% chance of minor degradation
      bar = [
        { status: "success", height: 95 },
        { status: "degraded", height: 5 },
      ];
    } else {
      // 92% fully operational
      bar = [{ status: "success", height: 100 }];
    }

    // Calculate card durations based on actual bar segments (24 hours per day)
    const totalHeight = bar.reduce((sum, segment) => sum + segment.height, 0);
    const statusCounts: Record<string, number> = {
      success: 0,
      degraded: 0,
      error: 0,
    };

    // Sum up heights by status
    for (const segment of bar) {
      statusCounts[segment.status] += segment.height;
    }

    // Create card entries only for statuses with non-zero values
    const card = (["success", "degraded", "error"] as const)
      .map((status) => {
        const percentage = statusCounts[status] / totalHeight;
        const totalHours = percentage * 24;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);

        // Format duration
        let value: string;
        if (totalHours < 1) {
          // Less than 1 hour: show only minutes
          value = `${Math.round(totalHours * 60)}m`;
        } else if (minutes === 0) {
          // Whole hours: show only hours
          value = `${hours}h`;
        } else {
          // Mixed: show hours and minutes
          value = `${hours}h ${minutes}m`;
        }

        return { status, value, hours: totalHours };
      })
      .filter((entry) => entry.hours > 0) // Only show non-zero durations
      .map(({ status, value }) => ({ status, value }));

    data.push({
      day: day.toISOString(),
      bar,
      card,
      events: [],
    });
  }

  return data;
}

/**
 * Adds incidents and maintenance events to the uptime data
 * This connects status reports to specific days on the status bar
 */
function addEventsToData(
  data: StatusBarData[],
  statusReports: StatusReport[],
  maintenances: Maintenance[],
): StatusBarData[] {
  // Add status report incidents to the data
  for (const report of statusReports) {
    const incidentDate = report.updates[0].date; // Use first update as incident start
    const dayIndex = data.findIndex((d) => {
      const dayDate = new Date(d.day);
      const incDate = new Date(incidentDate);
      return (
        dayDate.getFullYear() === incDate.getFullYear() &&
        dayDate.getMonth() === incDate.getMonth() &&
        dayDate.getDate() === incDate.getDate()
      );
    });

    if (dayIndex >= 0) {
      // Calculate incident duration from updates
      const startTime = report.updates[0].date;
      const endTime = report.updates[report.updates.length - 1].date;

      data[dayIndex].events = [
        ...(data[dayIndex].events || []),
        {
          id: report.id,
          name: report.title,
          type: "incident",
          from: new Date(startTime),
          to: new Date(endTime),
        },
      ];

      // Update bar to show degraded/error status on incident day
      const duration =
        (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // hours
      const affectedPercentage = Math.min((duration / 24) * 100, 100);

      if (affectedPercentage > 0) {
        data[dayIndex].bar = [
          { status: "success" as const, height: 100 - affectedPercentage },
          { status: "degraded" as const, height: affectedPercentage },
        ].filter((segment) => segment.height > 0);

        // Recalculate card with new bar data
        const totalHeight = data[dayIndex].bar.reduce(
          (sum, segment) => sum + segment.height,
          0,
        );
        const statusCounts: Record<string, number> = {
          success: 0,
          degraded: 0,
          error: 0,
        };

        for (const segment of data[dayIndex].bar) {
          statusCounts[segment.status] += segment.height;
        }

        data[dayIndex].card = (["success", "degraded", "error"] as const)
          .map((status) => {
            const percentage = statusCounts[status] / totalHeight;
            const totalHours = percentage * 24;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);

            let value: string;
            if (totalHours < 1) {
              value = `${Math.round(totalHours * 60)}m`;
            } else if (minutes === 0) {
              value = `${hours}h`;
            } else {
              value = `${hours}h ${minutes}m`;
            }

            return { status, value, hours: totalHours };
          })
          .filter((entry) => entry.hours > 0)
          .map(({ status, value }) => ({ status, value }));
      }
    }
  }

  // Add maintenance events to the data
  for (const maintenance of maintenances) {
    const maintenanceDate = new Date(maintenance.from);
    const dayIndex = data.findIndex((d) => {
      const dayDate = new Date(d.day);
      return (
        dayDate.getFullYear() === maintenanceDate.getFullYear() &&
        dayDate.getMonth() === maintenanceDate.getMonth() &&
        dayDate.getDate() === maintenanceDate.getDate()
      );
    });

    if (dayIndex >= 0) {
      data[dayIndex].events = [
        ...(data[dayIndex].events || []),
        {
          id: maintenance.id,
          name: maintenance.title,
          type: "maintenance",
          from: new Date(maintenance.from),
          to: new Date(maintenance.to),
        },
      ];
    }
  }

  return data;
}

interface Monitor {
  name: string;
  status: Exclude<StatusType, "empty">;
  uptime: string;
  data: StatusBarData[];
}

/**
 * StatusPageExample - Complete working example of a status page
 *
 * This component demonstrates:
 * - Overall system status with StatusBanner
 * - Multiple monitors with uptime bars
 * - Proper component composition
 * - Mock data structure
 *
 * @example
 * ```tsx
 * import { StatusPageExample } from "./shadcn-registry"
 *
 * export default function Page() {
 *   return <StatusPageExample />
 * }
 * ```
 */
export function StatusPageExample() {
  // Mock status reports (incidents) - defined first so we can link them to data
  const statusReports: StatusReport[] = [
    {
      id: 1,
      title: "API Response Time Degradation",
      affected: ["API", "Database"],
      updates: [
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          message:
            "We are investigating elevated response times on our API endpoints.",
          status: "investigating",
        },
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
          message:
            "We have identified a database query optimization issue causing the slowdown.",
          status: "identified",
        },
        {
          date: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
          ), // 2 hours later
          message:
            "Database queries have been optimized. Monitoring performance improvements.",
          status: "monitoring",
        },
        {
          date: new Date(
            Date.now() - 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
          ), // 3 hours later
          message:
            "Response times have returned to normal. This incident has been resolved.",
          status: "resolved",
        },
      ],
    },
  ];

  // Mock maintenance windows
  const maintenances: Maintenance[] = [
    {
      id: 3,
      title: "Scheduled Database Maintenance",
      affected: ["API", "Database"],
      message:
        "We will be performing routine database maintenance to improve performance and apply security updates. Expect brief periods of increased latency during this window.",
      from: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      to: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
    },
  ];

  // Generate mock data for each monitor and add events
  let apiData = generateMockUptimeData();
  apiData = addEventsToData(apiData, statusReports, maintenances);

  const websiteData = generateMockUptimeData();
  const databaseData = generateMockUptimeData();

  const monitors: Monitor[] = [
    {
      name: "API",
      status: "success",
      uptime: "99.8%",
      data: apiData,
    },
    {
      name: "Website",
      status: "success",
      uptime: "99.9%",
      data: websiteData,
    },
    {
      name: "Database",
      status: "success",
      uptime: "100%",
      data: databaseData,
    },
  ];

  // Determine overall system status based on monitors
  const hasError = monitors.some((m) => m.status === "error");
  const hasDegraded = monitors.some((m) => m.status === "degraded");
  const systemStatus: Exclude<StatusType, "empty"> = hasError
    ? "error"
    : hasDegraded
      ? "degraded"
      : "success";

  return (
    <Status
      variant={systemStatus}
      className="mx-auto max-w-[800px] px-[125px] py-2"
    >
      <StatusHeader>
        <StatusTitle>System Status</StatusTitle>
        <StatusDescription>
          Current status of all services and infrastructure
        </StatusDescription>
      </StatusHeader>
      <StatusBanner status={systemStatus} />
      <StatusContent>
        <StatusComponent variant={monitors[0].status}>
          <StatusComponentHeader>
            <StatusComponentHeaderLeft>
              <StatusComponentTitle>{monitors[0].name}</StatusComponentTitle>
            </StatusComponentHeaderLeft>
            <StatusComponentHeaderRight>
              <StatusComponentUptime>
                {monitors[0].uptime}
              </StatusComponentUptime>
              <StatusComponentStatus />
            </StatusComponentHeaderRight>
          </StatusComponentHeader>
          <StatusComponentBody>
            <StatusBar data={monitors[0].data} />
            <StatusComponentFooter data={monitors[0].data} />
          </StatusComponentBody>
        </StatusComponent>
        <StatusComponentGroup
          title="Infrastructure"
          status={
            monitors.slice(1).some((m) => m.status === "error")
              ? "error"
              : monitors.slice(1).some((m) => m.status === "degraded")
                ? "degraded"
                : "success"
          }
          defaultOpen={true}
        >
          {monitors.slice(1).map((monitor) => (
            <StatusComponent key={monitor.name} variant={monitor.status}>
              <StatusComponentHeader>
                <StatusComponentHeaderLeft>
                  <StatusComponentTitle>{monitor.name}</StatusComponentTitle>
                </StatusComponentHeaderLeft>
                <StatusComponentHeaderRight>
                  <StatusComponentUptime>
                    {monitor.uptime}
                  </StatusComponentUptime>
                  <StatusComponentStatus />
                </StatusComponentHeaderRight>
              </StatusComponentHeader>
              <StatusComponentBody>
                <StatusBar data={monitor.data} />
                <StatusComponentFooter data={monitor.data} />
              </StatusComponentBody>
            </StatusComponent>
          ))}
        </StatusComponentGroup>
        <Separator className="my-6" />
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Recent Events</h2>
          <StatusFeed
            statusReports={statusReports}
            maintenances={maintenances}
          />
        </div>
      </StatusContent>
    </Status>
  );
}
