"use client";

import { useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui";

import { StatusReportUpdateForm } from "@/components/forms/status-report-update/form";

export function StatusUpdateButton({
  statusReportId,
}: {
  statusReportId: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Status Update</Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-scroll sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>New Status Report</DialogTitle>
          <DialogDescription>
            Provide a status update and add it to the report history.
          </DialogDescription>
        </DialogHeader>
        <StatusReportUpdateForm
          statusReportId={statusReportId}
          onSubmit={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
