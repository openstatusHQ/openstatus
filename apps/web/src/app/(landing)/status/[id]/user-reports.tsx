"use client";

import { REPORT_WINDOW_MINUTES } from "@openstatus/api/src/router/effective-status";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { Bar, BarChart, XAxis } from "recharts";

import { api } from "@/trpc/rq-client";

const chartConfig = {
  total: { label: "Reports", color: "var(--color-warning)" },
} satisfies ChartConfig;

function countries(n: number): string {
  if (n <= 0) return "";
  return ` from ${n} ${n === 1 ? "country" : "countries"}`;
}

function buildSeries(
  daily: { day: string; total: number }[],
  days: number,
): { day: string; total: number }[] {
  const byDay = new Map(daily.map((d) => [d.day.slice(0, 10), d.total]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key, total: byDay.get(key) ?? 0 };
  });
}

export function UserReports({
  slug,
  serviceName,
  days,
}: {
  slug: string;
  serviceName: string;
  days: number;
}) {
  const [data] = api.externalService.reports.useSuspenseQuery({ slug, days });
  const { window: win, threshold, daily, topCountries } = data;

  const series = buildSeries(daily, days);
  const hasDaily = daily.some((d) => d.total > 0);

  if (win.reporters === 0 && !hasDaily) return null;

  const active = win.reporters >= threshold;

  return (
    <>
      <h2>{serviceName} user reports</h2>
      <div className="not-prose flex flex-col gap-3">
        {active ? (
          <div className="border-warning/30 bg-warning/10 text-warning border px-3 py-2 text-sm">
            Users are reporting problems with {serviceName}: {win.reporters} in
            the last {REPORT_WINDOW_MINUTES} minutes{countries(win.countries)}.
          </div>
        ) : (
          <p className="text-muted-foreground m-0! text-sm">
            {win.reporters} user {win.reporters === 1 ? "report" : "reports"} in
            the last {REPORT_WINDOW_MINUTES} minutes{countries(win.countries)}.
          </p>
        )}

        {hasDaily ? (
          <ChartContainer config={chartConfig} className="h-9 w-full">
            <BarChart
              accessibilityLayer
              data={series}
              barCategoryGap={1}
              margin={{ top: 1, right: 0, bottom: 0, left: 0 }}
            >
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => {
                      const day = payload?.[0]?.payload?.day;
                      return day
                        ? new Date(day).toLocaleDateString(undefined, {
                            timeZone: "UTC",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "";
                    }}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="var(--color-total)"
                fillOpacity={0.7}
                minPointSize={(value) => ((value ?? 0) > 0 ? 2 : 1)}
              />
              <XAxis dataKey="day" hide />
            </BarChart>
          </ChartContainer>
        ) : null}

        {topCountries.length > 0 ? (
          <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
            {topCountries.map((c) => (
              <span key={c.country} className="inline-flex border px-2 py-0.5">
                {c.country} · {c.total}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
