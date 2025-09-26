"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  InputWithAddons,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui";
import { Clock, Percent } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

const formSchema = z.object({
  uptime: z.number().min(0).max(100).default(99.99),
  downtime: z.string(), // 1h 10m 30s
});

export function UptimeSLAForm({
  defaultValues,
}: {
  defaultValues?: z.infer<typeof formSchema>;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const watchUptime = form.watch("uptime");
  const watchDowntime = form.watch("downtime");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          console.log(data);
        })}
        className="w-full"
      >
        <Tabs defaultValue="uptime" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="uptime" className="w-full">
              <span className="block sm:hidden">Uptime</span>
              <span className="hidden sm:block">Uptime Percentage</span>
            </TabsTrigger>
            <TabsTrigger value="downtime" className="w-full">
              <span className="block sm:hidden">Downtime</span>
              <span className="hidden sm:block">Downtime Duration</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="uptime" className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="uptime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Uptime</FormLabel>
                    <InputWithAddons
                      type="number"
                      placeholder="99.99"
                      leading={<Percent className="mt-1 size-4" />}
                      step={0.01}
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) => {
                        // Convert comma to dot for parsing, but keep comma in display
                        const normalizedValue = e.target.value.replace(
                          ",",
                          ".",
                        );
                        const value = Number.parseFloat(normalizedValue);
                        if (Number.isNaN(value)) {
                          field.onChange("");
                        } else {
                          field.onChange(value);
                        }
                      }}
                    />
                    <FormDescription>uptime percentage</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <div className="flex flex-wrap gap-0.5">
                  <Button
                    size="sm"
                    variant={watchUptime === 99.9 ? "default" : "outline"}
                    onClick={() => form.setValue("uptime", 99.9)}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      three nines
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchUptime === 99.99 ? "default" : "outline"}
                    onClick={() => form.setValue("uptime", 99.99)}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      four nines
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchUptime === 99.999 ? "default" : "outline"}
                    onClick={() => form.setValue("uptime", 99.999)}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      five nines
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchUptime === 99.9999 ? "default" : "outline"}
                    onClick={() => form.setValue("uptime", 99.9999)}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      six nines
                    </Badge>
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <ul className="list-inside list-disc marker:text-muted-foreground/50">
                {periods.map((period) => {
                  const totalSeconds =
                    (watchUptime * periodsInSeconds[period]) / 100;
                  const allowedDowntimeSeconds =
                    periodsInSeconds[period] - totalSeconds;
                  return (
                    <li key={period}>
                      <span className="text-muted-foreground capitalize">
                        {period} reporting:
                      </span>{" "}
                      <span className="font-medium">
                        {formatDuration(Math.round(allowedDowntimeSeconds))}
                      </span>{" "}
                      <span className="text-muted-foreground">downtime</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="downtime" className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="downtime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Downtime</FormLabel>
                    <InputWithAddons
                      leading={<Clock className="mt-1 size-4" />}
                      type="text"
                      placeholder="11h 30m 10s"
                      {...field}
                    />
                    <FormDescription>
                      downtime duration, e.g.{" "}
                      <code className="font-mono text-foreground">
                        1d 11h 30m 10s
                      </code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <div className="flex gap-0.5">
                  <Button
                    size="sm"
                    variant={watchDowntime === "1m" ? "default" : "outline"}
                    onClick={() => form.setValue("downtime", "1m")}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      1m
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchDowntime === "1h" ? "default" : "outline"}
                    onClick={() => form.setValue("downtime", "1h")}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      1h
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchDowntime === "1h 30m" ? "default" : "outline"}
                    onClick={() => form.setValue("downtime", "1h 30m")}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      1h 30m
                    </Badge>
                  </Button>
                  <Button
                    size="sm"
                    variant={watchDowntime === "1d" ? "default" : "outline"}
                    onClick={() => form.setValue("downtime", "1d")}
                    asChild
                  >
                    <Badge variant="outline" className="h-6 rounded-full px-2">
                      1d
                    </Badge>
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <ul className="list-inside list-disc marker:text-muted-foreground/50">
                {periods.map((period) => {
                  const downtimeSeconds = parseDowntimeToSeconds(watchDowntime);
                  const periodSeconds = periodsInSeconds[period];
                  const uptimePercentage = calculateUptimePercentage(
                    downtimeSeconds,
                    periodSeconds,
                  );

                  return (
                    <li key={period}>
                      <span className="text-muted-foreground capitalize">
                        {period} reporting:
                      </span>{" "}
                      <span className="font-medium">
                        {uptimePercentage.toFixed(5)}%{" "}
                        <span className="text-muted-foreground">uptime</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}
