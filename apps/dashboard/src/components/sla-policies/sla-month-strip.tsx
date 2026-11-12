import type { RouterOutputs } from "@openstatus/api";
import { cn } from "@openstatus/ui/lib/utils";

import { formatSlaMonth } from "@/data/sla-policies.client";

type StripMonth =
  RouterOutputs["monitorSlaPolicy"]["list"][number]["months"][number];

const cell = {
  met: "bg-success",
  missed: "bg-destructive",
  none: "bg-muted",
} as const satisfies Record<StripMonth["status"], string>;

const word = {
  met: "met",
  missed: "missed by at least one monitor",
  none: "no data",
} as const satisfies Record<StripMonth["status"], string>;

function monthTitle(month: StripMonth): string {
  return `${formatSlaMonth(month.month, { year: true })}: ${word[month.status]}${month.preview ? ", preview under today's terms" : ""}`;
}

/** Months as one row of cells, oldest first. */
export function SlaMonthStrip({
  months,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & {
  months: readonly StripMonth[];
}) {
  return (
    <ol
      data-slot="sla-month-strip"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    >
      {months.map((month) => {
        const title = monthTitle(month);
        return (
          <li
            key={month.month}
            title={title}
            className={cn(
              "h-4 w-2 shrink-0 rounded-xs",
              cell[month.status],
              month.preview && "opacity-40",
            )}
          >
            <span className="sr-only">{title}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SlaMonthLegend({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sla-month-legend"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function SlaMonthLegendItem({
  swatch,
  children,
}: {
  swatch: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2.5 rounded-xs", swatch)} />
      {children}
    </span>
  );
}

/** The legend of `SlaMonthStrip`. */
export function SlaMonthStripLegend({
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <SlaMonthLegend {...props}>
      <SlaMonthLegendItem swatch={cell.met}>Met</SlaMonthLegendItem>
      <SlaMonthLegendItem swatch={cell.missed}>Missed</SlaMonthLegendItem>
      <SlaMonthLegendItem swatch={cell.none}>No data</SlaMonthLegendItem>
      <SlaMonthLegendItem swatch="bg-success opacity-40">
        Preview, today&apos;s terms
      </SlaMonthLegendItem>
      {children}
    </SlaMonthLegend>
  );
}
