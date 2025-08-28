"use client";

import { ChartAreaPercentiles } from "@/components/chart/chart-area-percentiles";
import { useStatusPage } from "@/components/status-page/floating-button";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitorTitle } from "@/components/status-page/status-monitor";
import { StatusMonitorDescription } from "@/components/status-page/status-monitor";
import { monitors } from "@/data/monitors";
import Link from "next/link";

export default function Page() {
  const { variant } = useStatusPage();
  return (
    <Status variant={variant}>
      <StatusHeader>
        <StatusTitle>Craft</StatusTitle>
        <StatusDescription>Stay informed about the stability</StatusDescription>
      </StatusHeader>
      {/* TODO: create components */}
      <StatusContent className="flex flex-col gap-6">
        {monitors
          .filter((monitor) => monitor.public)
          .map((monitor) => (
            <Link
              key={monitor.id}
              href="/status-page/monitors/view"
              className="rounded-lg"
            >
              <div className="group -mx-3 -my-2 flex flex-col gap-2 rounded-lg border border-transparent px-3 py-2 hover:border-border/50 hover:bg-muted/50">
                <div className="flex flex-row items-center gap-2">
                  <StatusMonitorTitle>{monitor.name}</StatusMonitorTitle>
                  <StatusMonitorDescription>
                    {monitor.description}
                  </StatusMonitorDescription>
                </div>
                <ChartAreaPercentiles
                  className="h-[80px]"
                  legendClassName="pb-1"
                  singleSeries
                />
              </div>
            </Link>
          ))}
      </StatusContent>
    </Status>
  );
}
