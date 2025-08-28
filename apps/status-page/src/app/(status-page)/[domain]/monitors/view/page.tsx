"use client";

import { ChartAreaPercentiles } from "@/components/chart/chart-area-percentiles";
import { ChartLineRegions } from "@/components/chart/chart-line-regions";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/content/metric-card";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import {
  StatusChartContent,
  StatusChartDescription,
  StatusChartHeader,
  StatusChartTitle,
} from "@/components/status-page/status-charts";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { chartData } from "@/components/status-page/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { monitors } from "@/data/monitors";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { formatNumber } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import { Check, Copy, TrendingUp } from "lucide-react";
import { useState } from "react";

// TODO: add error range on ChartAreaLatency
// TODO: add timerange (1d, 7d, 14d) or leave as is and have 7d default?
// TODO: how to deal with the latency by region percentiles + interval/resolution

const metrics = [
  {
    label: "UPTIME",
    value: "99.99%",
    variant: "success" as const,
  },
  {
    label: "FAILS",
    value: "3",
    variant: "destructive" as const,
  },
  {
    label: "DEGRADED",
    value: "0",
    variant: "warning" as const,
  },
  {
    label: "CHECKS",
    value: "5.102",
    variant: "ghost" as const,
  },
];

export default function Page() {
  return (
    <Status>
      <StatusHeader>
        <StatusTitle>OpenStatus 418</StatusTitle>
        <StatusDescription>
          I&apos;m a teapot - Just random values
        </StatusDescription>
      </StatusHeader>
      <StatusContent className="flex flex-col gap-6">
        <div className="flex w-full flex-row items-center justify-between gap-2 py-0.5">
          <DropdownPeriod />
          <CopyButton />
        </div>
        <StatusMonitorTabs defaultValue="global">
          <StatusMonitorTabsList className="grid grid-cols-3">
            <StatusMonitorTabsTrigger value="global">
              <StatusMonitorTabsTriggerLabel>
                Global Latency
              </StatusMonitorTabsTriggerLabel>
              <StatusMonitorTabsTriggerValue>
                287 - 568ms{" "}
                <Badge variant="outline" className="py-px text-[10px]">
                  p75
                </Badge>
              </StatusMonitorTabsTriggerValue>
            </StatusMonitorTabsTrigger>
            <StatusMonitorTabsTrigger value="region">
              <StatusMonitorTabsTriggerLabel>
                Region Latency
              </StatusMonitorTabsTriggerLabel>
              <StatusMonitorTabsTriggerValue>
                7 regions{" "}
                <Badge
                  variant="outline"
                  className="py-px font-mono text-[10px]"
                >
                  arn <TrendingUp className="size-3" />
                </Badge>
              </StatusMonitorTabsTriggerValue>
            </StatusMonitorTabsTrigger>
            <StatusMonitorTabsTrigger value="uptime">
              <StatusMonitorTabsTriggerLabel>
                Uptime
              </StatusMonitorTabsTriggerLabel>
              <StatusMonitorTabsTriggerValue>
                99.99%{" "}
                <Badge variant="outline" className="py-px text-[10px]">
                  {formatNumber(5102, {
                    notation: "compact",
                    compactDisplay: "short",
                  }).replace("K", "k")}{" "}
                  checks
                </Badge>
              </StatusMonitorTabsTriggerValue>
            </StatusMonitorTabsTrigger>
          </StatusMonitorTabsList>
          <StatusMonitorTabsContent value="global">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Global Latency</StatusChartTitle>
                <StatusChartDescription>
                  The aggregated latency from all active regions based on
                  different <PopoverQuantile>quantiles</PopoverQuantile>.
                </StatusChartDescription>
              </StatusChartHeader>
              <ChartAreaPercentiles
                className="h-[250px]"
                legendClassName="justify-start pt-1 ps-1"
                legendVerticalAlign="top"
                xAxisHide={false}
                yAxisDomain={[0, "dataMax"]}
              />
            </StatusChartContent>
          </StatusMonitorTabsContent>
          <StatusMonitorTabsContent value="region">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Latency by Region</StatusChartTitle>
                <StatusChartDescription>
                  {/* TODO: we could add an information to p95 that it takes the highest selected global latency percentile */}
                  Region latency per{" "}
                  <code className="font-medium text-foreground">p75</code>{" "}
                  <PopoverQuantile>quantile</PopoverQuantile>, sorted by slowest
                  region. Compare up to{" "}
                  <code className="font-medium text-foreground">3</code>{" "}
                  regions.
                </StatusChartDescription>
              </StatusChartHeader>
              <ChartLineRegions className="h-[250px]" />
            </StatusChartContent>
          </StatusMonitorTabsContent>
          <StatusMonitorTabsContent value="uptime">
            <StatusChartContent>
              <StatusChartHeader>
                <StatusChartTitle>Total Uptime</StatusChartTitle>
                <StatusChartDescription>
                  Main values of uptime and availability, transparent.
                </StatusChartDescription>
              </StatusChartHeader>
              <MetricCardGroup className="sm:grid-cols-4 lg:grid-cols-4">
                {metrics.map((metric) => {
                  if (metric === null)
                    return <div key={metric} className="hidden lg:block" />;
                  return (
                    <MetricCard key={metric.label} variant={metric.variant}>
                      <MetricCardHeader>
                        <MetricCardTitle className="truncate">
                          {metric.label}
                        </MetricCardTitle>
                      </MetricCardHeader>
                      <MetricCardValue>{metric.value}</MetricCardValue>
                    </MetricCard>
                  );
                })}
              </MetricCardGroup>
              <StatusMonitor
                barType="absolute"
                cardType="requests"
                data={chartData}
                monitor={monitors[1]}
              />
            </StatusChartContent>
          </StatusMonitorTabsContent>
        </StatusMonitorTabs>
      </StatusContent>
    </Status>
  );
}

// Use Link instead of copy (same for reports and maintenance)
function CopyButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { copy, isCopied } = useCopyToClipboard();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() =>
        copy(window.location.href, {
          successMessage: "Link copied to clipboard",
        })
      }
      className={cn("size-8", className)}
      {...props}
    >
      {isCopied ? <Check /> : <Copy />}
      <span className="sr-only">Copy Link</span>
    </Button>
  );
}

const PERIOD_VALUES = [
  {
    value: "1d",
    label: "Last day",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "14d",
    label: "Last 14 days",
  },
];

function DropdownPeriod() {
  const [period, setPeriod] = useState("1d");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {PERIOD_VALUES.find(({ value }) => value === period)?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
            Period
          </DropdownMenuLabel>
          {PERIOD_VALUES.map(({ value, label }) => (
            <DropdownMenuItem key={value} onSelect={() => setPeriod(value)}>
              {label}
              {period === value ? <Check className="ml-auto shrink-0" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PopoverQuantile({
  children,
  className,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "shrink-0 rounded-md p-0 underline decoration-muted-foreground/70 decoration-dotted underline-offset-2 outline-none transition-all hover:decoration-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=open]:decoration-foreground dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent side="top" className="p-0 text-sm">
        <p className="px-3 py-2 font-medium">
          A quantile represents a specific percentile in your dataset.
        </p>
        <Separator />
        <p className="px-3 py-2 text-muted-foreground">
          For example, p50 is the 50th percentile - the point below which 50% of
          data falls. Higher percentiles include more data and highlight the
          upper range.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function StatusMonitorTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return <Tabs className={cn("gap-6", className)} {...props} />;
}

function StatusMonitorTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn("flex h-auto min-h-fit w-full", className)}
      {...props}
    />
  );
}

function StatusMonitorTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "min-w-0 flex-1 flex-col items-start gap-0.5 text-foreground dark:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function StatusMonitorTabsTriggerLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("w-full truncate text-left", className)} {...props} />
  );
}

function StatusMonitorTabsTriggerValue({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-wrap text-left text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

function StatusMonitorTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent className={cn("flex flex-col gap-2", className)} {...props} />
  );
}
