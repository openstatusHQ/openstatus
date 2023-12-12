"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import type { StatusReportUpdate } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";

import { DeleteStatusReportUpdateButtonIcon } from "@/app/app/[workspaceSlug]/(dashboard)/status-reports/_components/delete-status-update";
import { Icons } from "@/components/icons";
import { statusDict } from "@/data/incidents-dictionary";
import { useProcessor } from "@/hooks/use-preprocessor";
import { cn } from "@/lib/utils";

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
  const router = useRouter();

  // TODO: make it simpler..
  const sortedArray = statusReportUpdates.sort((a, b) => {
    const orderA = statusDict[a.status].order;
    const orderB = statusDict[b.status].order;
    return orderB - orderA;
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
              "group relative -m-2 flex gap-4 border border-transparent p-2",
              editable && "hover:bg-accent/40 hover:rounded-lg",
            )}
          >
            <div className="relative">
              <div className="bg-background border-border rounded-full border p-2">
                <StatusIcon className="h-4 w-4" />
              </div>
              {i !== sortedArray.length - 1 ? (
                <div className="bg-muted absolute inset-x-0 mx-auto h-full w-[2px]" />
              ) : null}
            </div>
            <div className="mt-1 grid flex-1">
              {editable ? (
                <div className="absolute right-2 top-2 hidden gap-2 group-hover:flex group-active:flex">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      router.push(
                        `./${update.statusReportId}/update/edit?statusUpdate=${update.id}`,
                      );
                    }}
                  >
                    <Icons.pencil className="h-4 w-4" />
                  </Button>
                  <DeleteStatusReportUpdateButtonIcon id={update.id} />
                </div>
              ) : undefined}
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-muted-foreground mt-px text-xs">
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
  const Component = useProcessor(message);
  return (
    <div
      className={cn(
        "prose dark:prose-invert prose-sm prose-headings:font-cal overflow-hidden text-ellipsis", // fixes very long words
        className,
      )}
    >
      {Component}
    </div>
  );
}
