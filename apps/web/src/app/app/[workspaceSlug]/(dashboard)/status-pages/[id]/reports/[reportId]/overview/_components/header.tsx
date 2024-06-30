"use client";

import { StatusReportUpdateForm } from "@/components/forms/status-report-update/form";
import { StatusBadge } from "@/components/status-update/status-badge";
import type { StatusReport } from "@openstatus/db/src/schema";
import {
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

export function Header({ report }: { report: StatusReport }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-cal text-lg">{report.title}</h3>
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
