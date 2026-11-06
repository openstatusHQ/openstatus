import type { RouterOutputs } from "@openstatus/api";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { ApiTrigger, Clock } from "@openstatus/icons";
import { getRegionInfo } from "@openstatus/regions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import {
  col,
  createTableSchema,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import {
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { addDays, addHours, endOfDay, startOfDay } from "date-fns";

import { HoverCardTiming } from "@/components/common/hover-card-timing";
import type { HeartbeatPing } from "@/components/data-table/response-logs/data-table-basics";
import { TableCellEmpty } from "@/components/data-table/table-cell-empty";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { cn } from "@/lib/utils";

export type ResponseLog =
  RouterOutputs["tinybird"]["listInfinite"]["data"][number];
/** A row of the logs table: a check's response, or a heartbeat's ping. */
export type LogRow = ResponseLog | HeartbeatPing;

type JobType = RouterOutputs["monitor"]["get"]["jobType"];

export const REQUEST_STATUS = ["success", "degraded", "error"] as const;
export const PING_KINDS = ["success", "fail"] as const;
export const TRIGGERS = ["cron", "api"] as const;
/** The checker's max tries is the monitor's retry setting, capped at 10. */
export const ATTEMPTS = Array.from({ length: 10 }, (_, i) => i + 1);

const STATUS_SWATCH: Record<string, string> = {
  success: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
  fail: "bg-destructive",
};

/** The same square the table cell draws, so the filter row reads as its legend. */
function StatusSwatch({ value }: { value: string }) {
  const swatch = STATUS_SWATCH[value];
  if (!swatch) return null;
  return <div className={cn(swatch, "size-2.5 shrink-0 rounded-[2px]")} />;
}

/** The leading swatch column: a check's request status, or a ping's kind. */
function resultColumn<const T extends readonly [string, ...string[]]>(
  values: T,
  labels?: Record<T[number], string>,
) {
  return col
    .enum(values)
    .label("Result")
    .hideHeader()
    .size(28)
    .defaultOpen()
    .filterable("checkbox", {
      options: values.map((value: T[number]) => ({
        label: labels?.[value] ?? value,
        value,
      })),
      // A closed set. A window without one of them must still offer the box,
      // or the filter reads as broken rather than empty.
      keepEmptyOptions: true,
      component: ({ label, value }) => (
        <span className="flex items-center gap-2 truncate font-normal">
          <StatusSwatch value={String(value)} />
          {label}
        </span>
      ),
    })
    .display("custom", {
      cell: (value) => {
        const swatch = STATUS_SWATCH[String(value)];
        if (!swatch) return <TableCellEmpty>Unknown</TableCellEmpty>;
        return (
          <div className="flex justify-center">
            <div className={cn(swatch, "size-2.5 rounded-[2px]")} />
          </div>
        );
      },
    });
}

/**
 * `col.presets.timestamp()` but without `.sortable()`: the cursor pages on the
 * pipe's own DESC order, so a header sort would only reorder the rows already
 * fetched.
 */
function timestampColumn() {
  return col
    .timestamp()
    .label("Timestamp")
    .display("timestamp")
    .size(200)
    .filterable("timerange", { presets: createTimestampPresets() });
}

/**
 * The slider needs static bounds at schema-build time; the real ones arrive
 * with the facets and are fed to the table through `getFacetedMinMaxValues`.
 */
const LATENCY_BOUNDS = { min: 0, max: 30_000 };

/** How far back the list and facet pipes reach. */
export const RETENTION_DAYS = 14;

/**
 * The ranges the logs date popover offered before the table rewrite, capped at
 * retention: the picker derives its selectable window from these bounds, so
 * anything wider would query days the pipes cannot answer.
 */
function createTimestampPresets() {
  const now = new Date();
  return [
    { label: "Today", from: startOfDay(now), to: endOfDay(now), shortcut: "t" },
    {
      label: "Yesterday",
      from: startOfDay(addDays(now, -1)),
      to: endOfDay(addDays(now, -1)),
      shortcut: "y",
    },
    { label: "Last hour", from: addHours(now, -1), to: now, shortcut: "h" },
    { label: "Last 6 hours", from: addHours(now, -6), to: now, shortcut: "s" },
    {
      label: "Last 24 hours",
      from: addHours(now, -24),
      to: now,
      shortcut: "d",
    },
    {
      label: "Last 7 days",
      from: startOfDay(addDays(now, -6)),
      to: endOfDay(now),
      shortcut: "w",
    },
    {
      label: `Last ${RETENTION_DAYS} days`,
      from: startOfDay(addDays(now, -(RETENTION_DAYS - 1))),
      to: endOfDay(now),
      shortcut: "b",
    },
  ];
}

export function createLogsTableSchema(options: {
  regions: string[];
  privateLocations: PrivateLocation[];
  /** Defaults to the widest schema — every column the checkers can fill. */
  jobType?: JobType;
}) {
  const { regions, privateLocations, jobType = "http" } = options;

  // Only the HTTP checker records a status code. Leaving the column in would
  // expose a filter whose every option matches nothing on the other job types.
  const hasStatusCode = jobType === "http";

  // `regions` is only what the monitor runs in *today*, but the window still
  // holds rows from regions since removed. Every known region therefore gets a
  // label and an enum value — otherwise those rows are unfilterable and a
  // hand-written region would parse back to null — and the facets decide which
  // of them the filter actually offers. Configured regions stay first so the
  // common case keeps the monitor's own order.
  const regionOptions = [
    ...[
      ...regions,
      ...monitorRegions.filter((region) => !regions.includes(region)),
    ].map((region) => {
      const info = getRegionInfo(region);
      return { label: `${info.flag} ${info.code}`, value: region };
    }),
    ...privateLocations.map((location) => ({
      label: `\u{1F310} ${location.name}`,
      value: String(location.id),
    })),
  ];

  return createTableSchema({
    requestStatus: resultColumn(REQUEST_STATUS),
    timestamp: timestampColumn(),

    ...(hasStatusCode
      ? { statusCode: col.presets.httpStatus().label("Status").size(90) }
      : {}),

    latency: col.presets
      .duration("ms", LATENCY_BOUNDS)
      .label("Latency")
      .size(110)
      .display("custom", {
        cell: (value) => (
          <TableCellNumber value={value as number | null} unit="ms" />
        ),
      }),

    region: col
      .enum(
        regionOptions.map((option) => option.value) as [string, ...string[]],
      )
      .label("Region")
      .size(120)
      .filterable("checkbox", { options: regionOptions })
      .display("custom", {
        cell: (value) => (
          <TableCellRegion
            value={String(value)}
            privateLocations={privateLocations}
            variant="code"
          />
        ),
      }),

    timing: col
      .record()
      .label("Timing")
      .size(130)
      .display("custom", {
        cell: (_value, row) => {
          const log = row as ResponseLog;
          if (!log.timing) return <TableCellEmpty>No timing</TableCellEmpty>;
          return <HoverCardTiming timing={log.timing} latency={log.latency} />;
        },
      }),

    attempts: col
      .number()
      .label("Attempts")
      .size(90)
      .hidden()
      .filterable("checkbox", {
        options: ATTEMPTS.map((value) => ({ label: String(value), value })),
      })
      .display("custom", {
        cell: (value) => <TableCellNumber value={value as number | null} />,
      }),

    trigger: col
      .enum(TRIGGERS)
      .label("Trigger")
      .size(80)
      .hidden()
      .filterable("checkbox", {
        options: TRIGGERS.map((value) => ({
          label: value === "cron" ? "Scheduled" : "API",
          value,
        })),
      })
      .display("custom", {
        cell: (value) => {
          if (value !== "cron" && value !== "api")
            return <TableCellEmpty>Unknown</TableCellEmpty>;
          const Icon = value === "cron" ? Clock : ApiTrigger;
          const label = value === "cron" ? "Scheduled" : "API";
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Icon className="text-muted-foreground size-3" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      }),
  });
}

/** A ping is pushed to us, so it has no region, latency or status code: only who sent what. */
export function createPingsTableSchema() {
  const text = (label: string, size: number) =>
    // only the pipe filters; a text search would cover the fetched rows alone
    col
      .string()
      .label(label)
      .size(size)
      .notFilterable()
      .display("custom", {
        cell: (value) =>
          value ? (
            <span className="font-mono">{String(value)}</span>
          ) : (
            <TableCellEmpty />
          ),
      });

  return createTableSchema({
    kind: resultColumn(PING_KINDS, { success: "success", fail: "failed" }),
    timestamp: timestampColumn(),
    method: text("Method", 90),
    ip: text("IP", 160),
    userAgent: text("User agent", 320),
  });
}

export function createLogsTable(options: {
  regions: string[];
  privateLocations: PrivateLocation[];
  jobType?: JobType;
}) {
  const schema =
    options.jobType === "heartbeat"
      ? createPingsTableSchema()
      : createLogsTableSchema(options);
  return {
    schema,
    columns: generateColumns<LogRow>(schema.definition),
    filterFields: generateFilterFields<LogRow>(schema.definition),
    filterSchema: generateFilterSchema(schema.definition),
  };
}
