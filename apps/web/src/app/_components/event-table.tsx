"use client";

import { formatDistance } from "date-fns";
import React from "react";

import type { Ping } from "@openstatus/tinybird";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function EventTable({ events }: { events: Ping[] }) {
  const [open, toggle] = React.useReducer((state) => !state, false);
  return (
    <div className="relative max-h-56 overflow-hidden">
      <div className="relative max-h-56 overflow-y-scroll">
        <Table>
          <TableCaption>
            A list of the latest {events.length} pings.
          </TableCaption>
          <TableHeader>
            <TableRow className="sticky top-0">
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency (ms)</TableHead>
              <TableHead className="text-right">Region</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isOk = event.statusCode === 200;
              return (
                <TableRow key={`${event.timestamp}-${event.region}`}>
                  <TableCell className="font-medium">
                    {formatDistance(new Date(event.timestamp), new Date(), {
                      addSuffix: true,
                      includeSeconds: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-2 py-0.5 text-xs",
                        isOk
                          ? "border-green-500/20 bg-green-500/10"
                          : "border-red-500/20 bg-red-500/10",
                      )}
                    >
                      {event.statusCode}
                      <div
                        className={cn(
                          "bg-foreground ml-1 h-1.5 w-1.5 rounded-full",
                          isOk ? "bg-green-500" : "bg-red-500",
                        )}
                      />
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-light">
                    {event.latency}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate text-right">
                    {event.region}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!open && (
        <div className="bg-gradient to-background absolute inset-0 flex items-end justify-center bg-gradient-to-b from-transparent from-20%">
          <Button
            onClick={toggle}
            variant="outline"
            size="sm"
            className="rounded-full backdrop-blur-sm"
          >
            A total of {events.length} events.
          </Button>
        </div>
      )}
    </div>
  );
}
