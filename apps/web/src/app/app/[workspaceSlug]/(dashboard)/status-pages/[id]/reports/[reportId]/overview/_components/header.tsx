"use client";

import { StatusReportUpdateForm } from "@/components/forms/status-report-update/form";
import { StatusBadge } from "@/components/status-update/status-badge";
import { formatDate } from "@/lib/utils";
import type {
  Monitor,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Separator,
} from "@openstatus/ui";
import { useState } from "react";

export function Header({
  report,
  monitors,
}: {
  report: StatusReport & { statusReportUpdates: StatusReportUpdate[] };
  monitors?: Pick<Monitor, "name" | "id">[];
}) {
  const [open, setOpen] = useState(false);

  const firstUpdate = report.statusReportUpdates?.[0];
  const _lastUpdate =
    report.statusReportUpdates?.[report.statusReportUpdates?.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h3 className="font-cal text-lg">{report.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
            <span className="font-mono">
              {firstUpdate?.date
                ? formatDate(firstUpdate?.date)
                : "Missing date"}
            </span>
            <span className="text-muted-foreground/50 text-xs">•</span>
            <StatusBadge status={report.status} />
            <span className="text-muted-foreground/50 text-xs">•</span>
            {monitors?.map(({ name, id }) => (
              <Badge key={id} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Create Status Update Report</Button>
          </DialogTrigger>
          <DialogContent className="max-h-screen overflow-y-scroll sm:max-w-[650px]">
            <DialogHeader>
              <DialogTitle>Edit Status Report</DialogTitle>
              <DialogDescription>
                Update your status report with new information.
              </DialogDescription>
            </DialogHeader>
            <StatusReportUpdateForm
              statusReportId={report.id}
              onSubmit={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <Separator />
    </div>
  );
}
