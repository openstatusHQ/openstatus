"use client";

import { useState } from "react";

import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/src/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/src/components/dialog";

import { StatusReportUpdateForm } from "../forms/status-report-update/form";
import { Icons } from "../icons";

export function EditStatusReportUpdateIconButton({
  statusReportId,
  statusReportUpdate,
}: {
  statusReportId: number;
  statusReportUpdate?: InsertStatusReportUpdate;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <Icons.pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-y-scroll sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Edit Status Report</DialogTitle>
          <DialogDescription>
            Update your status report with new information.
          </DialogDescription>
        </DialogHeader>
        <StatusReportUpdateForm
          statusReportId={statusReportId}
          defaultValues={statusReportUpdate}
          onSubmit={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
