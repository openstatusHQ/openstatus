"use client";

import React from "react";
import { formatDistance } from "date-fns";
import type { z } from "zod";

import type { tinyBirdEventType } from "@openstatus/tinybird";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function EventTable({
  events,
}: {
  // FIXME: should be return type
  events: z.infer<typeof tinyBirdEventType>[];
}) {
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
              <TableHead>Latency</TableHead>
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
                          ? "border-green-100 bg-green-50"
                          : "border-red-100 bg-red-50",
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
                  <TableCell className="text-muted-foreground">
                    {event.latency}
                  </TableCell>
                  <TableCell className="truncate text-right font-light">
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
