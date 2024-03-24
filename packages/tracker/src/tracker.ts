import type {
  Incident,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import type { Monitor } from "@openstatus/tinybird";

import { isInBlacklist } from "./blacklist";
import { classNames, statusDetails } from "./config";
import type { StatusDetails, StatusVariant } from "./types";
import { Status } from "./types";
import { endOfDay, isSameDay, startOfDay } from "./utils";

type Monitors = Monitor[];
type StatusReports = (StatusReport & {
  statusReportUpdates?: StatusReportUpdate[];
})[];
type Incidents = Incident[];

/**
 * Tracker Class is supposed to handle the data and calculate from a single monitor.
 * But we use it to handle the StatusCheck as well (with no data for a single monitor).
 * We can create Inheritence to handle the StatusCheck and Monitor separately and even
 * StatusPage with multiple Monitors.
 */
export class Tracker {
  private data: Monitors = [];
  private statusReports: StatusReports = [];
  private incidents: Incidents = [];

  constructor(arg: {
    data?: Monitors;
    statusReports?: StatusReports;
    incidents?: Incidents;
  }) {
    this.data = arg.data || []; // TODO: use another Class to handle a single Day
    this.statusReports = arg.statusReports || [];
    this.incidents = arg.incidents || [];
  }

  private calculateUptime(data: { ok: number; count: number }[]) {
    const { count, ok } = this.aggregatedData(data);
    if (count === 0) return 100; // starting with 100% uptime
    return Math.round((ok / count) * 10_000) / 100; // round to 2 decimal places
  }

  private aggregatedData(data: { ok: number; count: number }[]) {
    return data.reduce(
      (prev, curr) => {
        prev.ok += curr.ok;
        prev.count += curr.count;
        return prev;
      },
      { count: 0, ok: 0 },
    );
  }

  get isDataMissing() {
    const { count } = this.aggregatedData(this.data);
    return count === 0;
  }

  private calculateUptimeStatus(data: { ok: number; count: number }[]): Status {
    const uptime = this.calculateUptime(data);
    if (uptime >= 98) return Status.Operational;
    if (uptime >= 60) return Status.DegradedPerformance;
    if (uptime > 30) return Status.PartialOutage;
    return Status.MajorOutage;
  }

  private isOngoingIncident() {
    return this.incidents.some((incident) => !incident.resolvedAt);
  }

  private isOngoingReport() {
    const resolved: StatusReport["status"][] = ["monitoring", "resolved"];
    return this.statusReports.some(
      (report) => !resolved.includes(report.status),
    );
  }

  get totalUptime(): number {
    return this.calculateUptime(this.data);
  }

  get currentStatus(): Status {
    if (this.isOngoingReport()) return Status.DegradedPerformance;
    if (this.isOngoingIncident()) return Status.Incident;
    return this.calculateUptimeStatus(this.data);
  }

  get currentVariant(): StatusVariant {
    return statusDetails[this.currentStatus].variant;
  }

  get currentDetails(): StatusDetails {
    return statusDetails[this.currentStatus];
  }

  get currentClassName(): string {
    return classNames[this.currentVariant];
  }

  // HACK: this is a temporary solution to get the incidents
  private getIncidentsByDay(day: Date): Incidents {
    const incidents = this.incidents?.filter((incident) => {
      const { startedAt, resolvedAt } = incident;
      const eod = endOfDay(day);
      const sod = startOfDay(day);

      if (!startedAt) return false; // not started

      const hasStartedAfterEndOfDay = startedAt.getTime() >= eod.getTime();

      if (hasStartedAfterEndOfDay) return false;

      if (!resolvedAt) return true; // still ongoing

      const hasResolvedBeforeStartOfDay = resolvedAt.getTime() <= sod.getTime();

      if (hasResolvedBeforeStartOfDay) return false;

      const hasStartedBeforeEndOfDay = startedAt.getTime() <= eod.getTime();

      const hasResolvedBeforeEndOfDay = resolvedAt.getTime() <= eod.getTime();

      if (hasStartedBeforeEndOfDay || hasResolvedBeforeEndOfDay) return true;

      return false;
    });

    return incidents;
  }

  // HACK: this is a temporary solution to get the status reports
  private getStatusReportsByDay(props: Monitor): StatusReports {
    const statusReports = this.statusReports?.filter((report) => {
      const firstStatusReportUpdate = report?.statusReportUpdates?.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      )?.[0];

      if (!firstStatusReportUpdate) return false;

      const day = new Date(props.day);
      return isSameDay(firstStatusReportUpdate.date, day);
    });
    return statusReports;
  }

  // TODO: it would be great to create a class to handle a single day
  // FIXME: will be always generated on each tracker.days call - needs to be in the constructor?
  get days() {
    const data = this.data.map((props) => {
      const day = new Date(props.day);
      const blacklist = isInBlacklist(day);
      const incidents = this.getIncidentsByDay(day);
      const statusReports = this.getStatusReportsByDay(props);

      const isMissingData = props.count === 0;

      // FIXME:
      const status = incidents.length
        ? Status.Incident
        : isMissingData
          ? Status.Unknown
          : this.calculateUptimeStatus([props]);

      const variant = statusDetails[status].variant;
      const label = statusDetails[status].short;

      return {
        ...props,
        blacklist,
        incidents,
        statusReports,
        status,
        variant,
        label: isMissingData ? "Missing" : label,
      };
    });
    return data;
  }

  get toString() {
    return statusDetails[this.currentStatus].short;
  }
}
