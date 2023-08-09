"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type * as z from "zod";

import type { selectIncidentUpdateSchema } from "@openstatus/db/src/schema";

import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusDict } from "@/data/incidents-dictionary";
import { cn } from "@/lib/utils";
import { DeleteIncidentUpdateButtonIcon } from "./delete-incident-update";

type IncidentUpdateProps = z.infer<typeof selectIncidentUpdateSchema>;

export function Events({
  incidentUpdates,
}: {
  incidentUpdates: IncidentUpdateProps[];
}) {
  const [open, toggle] = React.useReducer((open) => !open, false);
  const router = useRouter();

  // TODO: make it simpler..
  const sortedArray = incidentUpdates.sort((a, b) => {
    const orderA = statusDict[a.status].order;
    const orderB = statusDict[b.status].order;
    return orderB - orderA;
  });
  const slicedArray = open
    ? sortedArray
    : sortedArray.length > 0
    ? [sortedArray[0]]
    : [];
  //

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">
        <span>{open ? "Last updates" : "Last update"}</span>
      </p>
      {slicedArray?.map((update, i) => {
        const { icon, label } = statusDict[update.status];
        const StatusIcon = Icons[icon];
        return (
          <div
            key={update.id}
            className={cn(
              "group relative -m-2 grid gap-2 border border-transparent p-2",
              "hover:bg-accent/40 hover:border-border hover:rounded-lg",
            )}
          >
            <div className="absolute right-2 top-2 hidden gap-2 group-hover:flex group-active:flex">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => {
                  router.push(
                    `./incidents/update/edit?incidentId=${update.incidentId}&id=${update.id}`,
                  );
                }}
              >
                <Icons.pencil className="h-4 w-4" />
              </Button>
              <DeleteIncidentUpdateButtonIcon id={update.id} />
            </div>
            <div className="text-muted-foreground flex items-center text-xs font-light">
              {format(new Date(update.date), "LLL dd, y HH:mm")}
              <span className="text-muted-foreground/70 mx-1">&bull;</span>
              <Badge variant="secondary">
                <StatusIcon className="mr-1 h-3 w-3" />
                {label}
              </Badge>
            </div>
            <div>
              <p className="max-w-3xl text-sm">{update.message}</p>
            </div>
          </div>
        );
      })}

      {incidentUpdates.length > 1 ? (
        <div className="text-center">
          <Button variant="ghost" onClick={toggle}>
            {open ? "Close all" : "All incidents"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
