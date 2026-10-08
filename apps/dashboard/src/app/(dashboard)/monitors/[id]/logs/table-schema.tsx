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
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellRegion } from "@/components/data-table/table-cell-region";
import { cn } from "@/lib/utils";

export type ResponseLog =
  RouterOutputs["tinybird"]["listInfinite"]["data"][number];

type JobType = RouterOutputs["monitor"]["get"]["jobType"];

export const REQUEST_STATUS = ["success", "degraded", "error"] as const;
export const TRIGGERS = ["cron", "api"] as const;

const STATUS_SWATCH: Record<string, string> = {
  success: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
};

function Dash() {
  return <div className="text-muted-foreground">-</div>;
}

/** The same square the table cell draws, so the filter row reads as its legend. */
function StatusSwatch({ value }: { value: string }) {
  const swatch = STATUS_SWATCH[value];
  if (!swatch) return null;
  return <div className={cn(swatch, "size-2.5 shrink-0 rounded-[2px]")} />;
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
    requestStatus: col
      .enum(REQUEST_STATUS)
      .label("Result")
      .hideHeader()
      .size(28)
      .defaultOpen()
      .filterable("checkbox", {
        options: REQUEST_STATUS.map((value) => ({ label: value, value })),
        // A closed set of three. A window with no degraded rows must still
        // offer the box, or the filter reads as broken rather than empty.
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
          if (!swatch) return <Dash />;
          return (
            <div className="flex justify-center">
              <div className={cn(swatch, "size-2.5 rounded-[2px]")} />
            </div>
          );
        },
      }),

    // `col.presets.timestamp()` but without `.sortable()`: the cursor pages on
    // the pipe's own DESC order, so a header sort would only reorder the rows
    // already fetched.
    timestamp: col
      .timestamp()
      .label("Timestamp")
      .display("timestamp")
      .size(200)
      .filterable("timerange", { presets: createTimestampPresets() }),

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
          if (!log.timing) return <Dash />;
          return <HoverCardTiming timing={log.timing} latency={log.latency} />;
        },
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
          if (value !== "cron" && value !== "api") return <Dash />;
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

export function createLogsTable(options: {
  regions: string[];
  privateLocations: PrivateLocation[];
  jobType?: JobType;
}) {
  const schema = createLogsTableSchema(options);
  return {
    schema,
    columns: generateColumns<ResponseLog>(schema.definition),
    filterFields: generateFilterFields<ResponseLog>(schema.definition),
    filterSchema: generateFilterSchema(schema.definition),
  };
}
