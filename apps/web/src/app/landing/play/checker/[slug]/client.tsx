"use client";

import { IconCloudProvider } from "@/components/icon-cloud-provider";
import {
  getTimingPhases,
  type CachedRegionChecker,
} from "@/components/ping-response-analysis/utils";
import { cn } from "@/lib/utils";
import { type Region, regionDict } from "@openstatus/regions";
import { Button } from "@openstatus/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui";
import { Input } from "@openstatus/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";
import { useState } from "react";

const STATUS_CODES = {
  "1": "text-muted-foreground",
  "2": "text-success",
  "3": "text-info",
  "4": "text-warning",
  "5": "text-destructive",
};

interface TableProps {
  data: CachedRegionChecker;
}

export function Table({ data }: TableProps) {
  const [input, setInput] = useState("");
  const [sort, setSort] = useState<{
    value: "latency" | "status" | "region";
    desc: boolean;
  }>({ value: "latency", desc: false });

  // Filter successful checks and calculate timing phases
  const checks = data.checks
    .filter((check) => check.state === "success" && check.timing)
    .map((check) => {
      const timing = getTimingPhases(check.timing);
      return {
        ...check,
        timingPhases: timing,
      };
    });

  const filteredAndSorted = checks
    .filter((check) => {
      const regionInfo = regionDict[check.region as Region];
      if (!regionInfo) return false;
      return [
        regionInfo.code,
        regionInfo.location,
        regionInfo.flag,
        regionInfo.continent,
      ].some((value) => value?.toLowerCase().includes(input.toLowerCase()));
    })
    .sort((a, b) => {
      if (sort.value === "status") {
        return sort.desc ? b.status - a.status : a.status - b.status;
      }
      if (sort.value === "latency") {
        return sort.desc ? b.latency - a.latency : a.latency - b.latency;
      }
      return sort.desc
        ? b.region.localeCompare(a.region)
        : a.region.localeCompare(b.region);
    });

  return (
    <div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search by region, flag, location code, or continent"
        className="h-auto! rounded-none p-4 text-base md:text-base"
      />
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="w-12" />
              <th>Region</th>
              <th>Status</th>
              <th>DNS</th>
              <th>Connect</th>
              <th>TLS</th>
              <th>TTFB</th>
              <th className="p-0! text-right!">
                <TableSort
                  onClick={() =>
                    setSort({ value: "latency", desc: !sort.desc })
                  }
                  direction={
                    sort.value === "latency"
                      ? sort.desc
                        ? "desc"
                        : "asc"
                      : undefined
                  }
                >
                  Latency
                </TableSort>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="border border-border border-dashed text-center"
                >
                  No data available
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((check) => {
                const regionInfo = regionDict[check.region as Region];
                if (!regionInfo) return null;

                const { dns, connection, tls, ttfb } = check.timingPhases;

                return (
                  <HeadersDialog
                    key={check.region}
                    headers={check.headers || {}}
                  >
                    <tr className="hover:bg-muted/50">
                      <td>
                        <IconCloudProvider
                          provider={regionInfo.provider}
                          className="size-4"
                        />
                      </td>
                      <td>
                        {regionInfo.flag} {regionInfo.code}{" "}
                        <span className="text-muted-foreground">
                          {regionInfo.location}
                        </span>
                      </td>
                      <td
                        className={cn(
                          STATUS_CODES[
                            check.status.toString()[0] as keyof typeof STATUS_CODES
                          ]
                        )}
                      >
                        {check.status}
                      </td>
                      <td>
                        {Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 0,
                        }).format(dns)}
                        ms
                      </td>
                      <td>
                        {Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 0,
                        }).format(connection)}
                        ms
                      </td>
                      <td>
                        {Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 0,
                        }).format(tls)}
                        ms
                      </td>
                      <td>
                        {Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 0,
                        }).format(ttfb)}
                        ms
                      </td>
                      <td className="text-right!">
                        {Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 0,
                        }).format(check.latency)}
                        ms
                      </td>
                    </tr>
                  </HeadersDialog>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableSort({
  children,
  className,
  direction,
  ...props
}: React.ComponentProps<typeof Button> & { direction?: "asc" | "desc" }) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "h-auto! w-full rounded-none p-4 text-base md:text-base",
        className
      )}
      {...props}
    >
      {children}
      <span className="flex flex-col ml-2">
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 text-[9px]",
            direction === "asc"
              ? "text-accent-foreground"
              : "text-muted-foreground"
          )}
        >
          ▲
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 text-[9px]",
            direction === "desc"
              ? "text-accent-foreground"
              : "text-muted-foreground"
          )}
        >
          ▼
        </span>
      </span>
    </Button>
  );
}

function HeadersDialog({
  headers,
  children,
}: {
  headers: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-none! font-mono sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Headers</DialogTitle>
          <DialogDescription className="text-base">
            Response headers sent by the server.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0">
          <Tabs defaultValue="raw">
            <TabsList className="h-auto w-full rounded-none">
              <TabsTrigger
                value="raw"
                className="h-auto w-full truncate rounded-none p-4"
              >
                Raw
              </TabsTrigger>
              <TabsTrigger
                value="table"
                className="h-auto w-full truncate rounded-none p-4"
              >
                Table
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="table"
              className="min-w-0 overflow-x-auto prose dark:prose-invert max-w-none"
            >
              <div className="min-w-0">
                <table className="my-0!">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Header</th>
                      <th className="break-words">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(headers).map(([key, value]) => (
                      <tr key={key}>
                        <td className="whitespace-nowrap font-medium">{key}</td>
                        <td className="break-words max-w-md">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent
              value="raw"
              className="min-w-0 overflow-x-auto prose dark:prose-invert max-w-none"
            >
              {/* NOTE: we can make it a readOnly textarea*/}
              <pre className="whitespace-pre-wrap break-words">
                {Object.entries(headers).map(([key, value]) => (
                  <code key={key} className="block break-words">
                    {key}: {value}
                  </code>
                ))}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
