"use client";

import { cn } from "@/lib/utils";
import { regionDict } from "@openstatus/regions";
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

const r = Object.values(regionDict).map((region) => {
  const latency = Math.random() * 1000;
  const status = Math.random() < 0.9 ? 200 : 500;
  return {
    region: region,
    latency,
    status,
    dns: latency * 0.08,
    connect: latency * 0.02,
    tls: latency * 0.1,
    ttfb: latency * 0.8,
    headers: {
      "Alt-Svc": 'h3=":443"; ma=2592000',
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/html",
      Date: "Mon, 17 Nov 2025 19:20:52 GMT",
      Etag: '"9d6228554b13b686fa06d4ef2d30a169"',
      "Last-Modified": "Thu, 13 Nov 2025 11:44:39 GMT",
      Link: '<https://framerusercontent.com>; rel="preconnect", <https://framerusercontent.com>; rel="preconnect"; crossorigin=""',
      Server: "Framer/8d3311c",
      "Server-Timing":
        'region;desc="us-east-1", cache;desc="cached", ssg-status;desc="optimized", version;desc="8d3311c"',
      "Strict-Transport-Security": "max-age=31536000",
      Vary: "Accept-Encoding",
      "X-Content-Type-Options": "nosniff",
    },
  };
});

export function Table() {
  const [input, setInput] = useState("");
  const [sort, setSort] = useState<{
    value: "latency" | "status" | "region";
    desc: boolean;
  }>({ value: "latency", desc: false });
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
            {r
              .filter(({ region }) => {
                return [
                  region.code,
                  region.location,
                  region.flag,
                  region.continent,
                ].some((value) =>
                  value?.toLowerCase().includes(input.toLowerCase()),
                );
              })
              .sort((a, b) => {
                if (sort.value === "status") {
                  return sort.desc ? b.status - a.status : a.status - b.status;
                }
                if (sort.value === "latency") {
                  return sort.desc
                    ? b.latency - a.latency
                    : a.latency - b.latency;
                }
                return sort.desc
                  ? b.region.code.localeCompare(a.region.code)
                  : a.region.code.localeCompare(b.region.code);
              })
              .map(
                ({
                  region,
                  latency,
                  status,
                  dns,
                  connect,
                  tls,
                  ttfb,
                  headers,
                }) => {
                  return (
                    <HeadersDialog key={region.code} headers={headers}>
                      <tr className="hover:bg-muted/50">
                        <td>
                          {region.flag} {region.code}{" "}
                          <span className="text-muted-foreground">
                            {region.location}
                          </span>
                        </td>
                        <td
                          className={cn(
                            STATUS_CODES[
                              status.toString()[0] as keyof typeof STATUS_CODES
                            ],
                          )}
                        >
                          {status}
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
                          }).format(connect)}
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
                          }).format(latency)}
                          ms
                        </td>
                      </tr>
                    </HeadersDialog>
                  );
                },
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
        className,
      )}
      {...props}
    >
      {children}
      <span className="flex flex-col">
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 text-[8px]",
            direction === "asc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
          )}
        >
          ▲
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 text-[8px]",
            direction === "desc"
              ? "text-accent-foreground"
              : "text-muted-foreground",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none font-mono sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Headers</DialogTitle>
          <DialogDescription className="text-base">
            Response headers sent by the server.
          </DialogDescription>
        </DialogHeader>
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
            className="prose dark:prose-invert max-w-none overflow-x-auto"
          >
            <div className="prose dark:prose-invert max-w-none overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Header</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(headers).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent
            value="raw"
            className="prose dark:prose-invert max-w-none overflow-x-auto"
          >
            {/* NOTE: we can make it a readOnly textarea*/}
            {Object.entries(headers).map(([key, value]) => (
              <code key={key} className="block">
                {key}: {value}
              </code>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
