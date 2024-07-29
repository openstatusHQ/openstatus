"use client";

import { format } from "date-fns";
import * as React from "react";

import type { StatusReportUpdate } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/src/components/button";

import { Icons } from "@/components/icons";
import { statusDict } from "@/data/incidents-dictionary";
import { useProcessor } from "@/hooks/use-preprocessor";
import { cn } from "@/lib/utils";
import { DeleteStatusReportUpdateButtonIcon } from "./delete-status-update";
import { EditStatusReportUpdateIconButton } from "./edit-status-update";

export function Events({
  statusReportUpdates,
  editable = false,
  collabsible = false,
}: {
  statusReportUpdates: StatusReportUpdate[];
  editable?: boolean;
  collabsible?: boolean;
}) {
  const [open, toggle] = React.useReducer((open) => !open, false);

  const sortedArray = statusReportUpdates.sort((a, b) => {
    return b.date.getTime() - a.date.getTime();
  });

  const slicedArray =
    open || !collabsible
      ? sortedArray
      : sortedArray.length > 0
        ? [sortedArray[0]]
        : [];
  //

  return (
    <div className="grid gap-3">
      {slicedArray?.map((update, i) => {
        const { icon, label } = statusDict[update.status];
        const StatusIcon = Icons[icon];
        return (
          <div
            key={update.id}
            className={cn(
              "group -m-2 relative flex gap-4 border border-transparent p-2",
              editable && "hover:rounded-lg hover:bg-accent/40",
            )}
          >
            <div className="relative">
              <div className="rounded-full border border-border bg-background p-2">
                <StatusIcon className="h-4 w-4" />
              </div>
              {i !== sortedArray.length - 1 ? (
                <div className="absolute inset-x-0 mx-auto h-full w-[2px] bg-muted" />
              ) : null}
            </div>
            <div className="mt-1 grid flex-1">
              {editable ? (
                <div className="absolute top-2 right-2 hidden gap-2 group-hover:flex group-active:flex">
                  <EditStatusReportUpdateIconButton
                    statusReportId={update.statusReportId}
                    statusReportUpdate={update}
                  />
                  <DeleteStatusReportUpdateButtonIcon id={update.id} />
                </div>
              ) : undefined}
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{label}</p>
                <p className="mt-px text-muted-foreground text-xs">
                  <code>
                    {format(new Date(update.date), "LLL dd, y HH:mm")}
                  </code>
                </p>
              </div>
              {/* <p className="max-w-3xl text-sm">{update.message}</p> */}
              <EventMessage message={update.message} />
            </div>
          </div>
        );
      })}
      {collabsible && statusReportUpdates.length > 1 ? (
        <div className="text-center">
          <Button variant="ghost" onClick={toggle}>
            {open ? "Close" : "More"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EventMessage({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  const Component = useProcessor(message); // FIXME: make it work with markdown without hook!
  return (
    <div
      className={cn(
        "prose dark:prose-invert prose-sm overflow-hidden text-ellipsis prose-headings:font-cal", // fixes very long words
        className,
      )}
    >
      {Component}
    </div>
  );
}
