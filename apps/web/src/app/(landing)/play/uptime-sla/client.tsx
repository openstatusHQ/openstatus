"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  TabsContent,
  TabsList,
  Tabs as TabsPrimitive,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { useState } from "react";

const periods = ["days", "weeks", "months", "years"] as const;

const periodsInSeconds = {
  days: 24 * 60 * 60,
  weeks: 24 * 60 * 60 * 7,
  months: 24 * 60 * 60 * 30,
  years: 24 * 60 * 60 * 365,
} satisfies Record<(typeof periods)[number], number>;

// Parse downtime string like "11h 30m 10s" or "1d 2h 30m" to seconds
function parseDowntimeToSeconds(downtime: string): number {
  if (!downtime.trim()) return 0;

  const regex = /(\d+)\s*(d|h|m|s)/g;
  let totalSeconds = 0;
  let match: RegExpExecArray | null = null;

  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  while ((match = regex.exec(downtime)) !== null) {
    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "w":
        totalSeconds += value * 24 * 60 * 60 * 7; // weeks
        break;
      case "d":
        totalSeconds += value * 24 * 60 * 60; // days
        break;
      case "h":
        totalSeconds += value * 60 * 60; // hours
        break;
      case "m":
        totalSeconds += value * 60; // minutes
        break;
      case "s":
        totalSeconds += value; // seconds
        break;
    }
  }

  return totalSeconds;
}

// Calculate uptime percentage from downtime seconds and period
function calculateUptimePercentage(
  downtimeSeconds: number,
  periodSeconds: number,
): number {
  if (downtimeSeconds >= periodSeconds) return 0;
  const uptimeSeconds = periodSeconds - downtimeSeconds;
  return (uptimeSeconds / periodSeconds) * 100;
}

// Format seconds into human-readable format (days, hours, minutes, seconds)
function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}

const ninesBadges = [
  {
    label: "three nines",
    value: 99.9,
  },
  {
    label: "four nines",
    value: 99.99,
  },
  {
    label: "five nines",
    value: 99.999,
  },
  {
    label: "six nines",
    value: 99.9999,
  },
];

const durationBadges = ["1m", "5m", "1h", "1h 30m", "1d"];

export function Calculation() {
  const [uptimePercentage, setUptimePercentage] = useState(99.99);
  const [downtimeDuration, setDowntimeDuration] = useState("1h 30m");
  return (
    <TabsPrimitive defaultValue="percentage">
      <TabsList className="h-auto w-full rounded-none">
        <TabsTrigger
          value="percentage"
          className="h-auto w-full truncate rounded-none p-4"
        >
          Uptime Percentage
        </TabsTrigger>
        <TabsTrigger
          value="duration"
          className="h-auto w-full truncate rounded-none p-4"
        >
          Downtime Duration
        </TabsTrigger>
      </TabsList>
      <TabsContent value="percentage" className="space-y-4 rounded-none">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="uptime-percentage"
            value={uptimePercentage}
            onChange={(e) => setUptimePercentage(Number(e.target.value))}
            type="number"
            placeholder="99.99"
            className="h-auto! rounded-none p-4 text-base md:text-base"
          />
          <div className="flex flex-wrap gap-2">
            {ninesBadges.map((badge) => (
              <Button
                key={badge.value}
                size="sm"
                variant={
                  uptimePercentage === badge.value ? "default" : "outline"
                }
                onClick={() => setUptimePercentage(badge.value)}
                className="rounded-none"
              >
                {badge.label}
              </Button>
            ))}
          </div>
        </div>
        <ul>
          {periods.map((period) => {
            const totalSeconds =
              (uptimePercentage * periodsInSeconds[period]) / 100;
            const allowedDowntimeSeconds =
              periodsInSeconds[period] - totalSeconds;
            return (
              <li key={period}>
                <span className="capitalize">{period} reporting:</span>{" "}
                <span className="font-medium text-foreground">
                  {formatDuration(Math.round(allowedDowntimeSeconds))}
                </span>{" "}
                <span>downtime</span>
              </li>
            );
          })}
        </ul>
      </TabsContent>
      <TabsContent value="duration" className="space-y-4 rounded-none">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="duration-downtime"
            value={downtimeDuration}
            placeholder="11h 30m 10s"
            onChange={(e) => setDowntimeDuration(e.target.value)}
            className="h-auto! rounded-none p-4 text-base md:text-base"
          />
          <div className="flex flex-wrap gap-2">
            {durationBadges.map((badge) => (
              <Button
                key={badge}
                size="sm"
                variant={downtimeDuration === badge ? "default" : "outline"}
                onClick={() => setDowntimeDuration(badge)}
                className="rounded-none"
              >
                {badge}
              </Button>
            ))}
          </div>
        </div>
        <ul>
          {periods.map((period) => {
            const downtimeSeconds = parseDowntimeToSeconds(downtimeDuration);
            const periodSeconds = periodsInSeconds[period];
            const uptimePercentage = calculateUptimePercentage(
              downtimeSeconds,
              periodSeconds,
            );

            return (
              <li key={period}>
                <span className="capitalize">{period} reporting:</span>{" "}
                <span className="font-medium text-foreground">
                  {uptimePercentage.toFixed(5)}%
                </span>{" "}
                <span>uptime</span>
              </li>
            );
          })}
        </ul>
      </TabsContent>
    </TabsPrimitive>
  );
}
