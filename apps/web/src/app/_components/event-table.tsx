"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistance } from "date-fns";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";
import { Button } from "@/components/ui/button";

export function EventTable({
  events,
}: {
  // FIXME: should be return type
  events: {
    id: string;
    timestamp: number;
    statusCode: number;
    latency: number;
    url: string;
  }[];
}) {
  const [open, toggle] = React.useReducer((state) => !state, false);
  return (
    <div className="relative overflow-hidden max-h-56">
      <div className="relative overflow-y-scroll max-h-56">
        <Table>
          <TableCaption>
            A list of the latest {events.length} pings.
          </TableCaption>
          <TableHeader>
            <TableRow className="sticky top-0">
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead className="text-right">URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isOk = event.statusCode === 200;
              const url = new URL(event.url);
              return (
                <TableRow key={event.timestamp}>
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
                        "text-xs py-0.5 px-2",
                        isOk
                          ? "border-green-100 bg-green-50"
                          : "border-red-100 bg-red-50"
                      )}
                    >
                      {event.statusCode}
                      <div
                        className={cn(
                          "rounded-full bg-foreground h-1.5 w-1.5 ml-1",
                          isOk ? "bg-green-500" : "bg-red-500"
                        )}
                      />
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.latency}
                  </TableCell>
                  <TableCell className="text-right font-light truncate">
                    {url.pathname}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!open && (
        <div className="absolute inset-0 flex items-end justify-center bg-gradient bg-gradient-to-b from-transparent from-20% to-background">
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
