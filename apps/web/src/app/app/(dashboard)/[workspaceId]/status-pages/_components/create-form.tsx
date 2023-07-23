"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type * as z from "zod";

import type {
  allMonitorsSchema,
  insertPageSchemaWithMonitors,
} from "@openstatus/db/src/schema";

import { StatusPageForm } from "@/components/forms/status-page-form";
import { LoadingAnimation } from "@/components/loading-animation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/trpc/client";

interface Props {
  workspaceId: number;
  allMonitors?: z.infer<typeof allMonitorsSchema>;
  disabled?: boolean;
}

export function CreateForm({ workspaceId, allMonitors, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onCreate({
    ...props
  }: z.infer<typeof insertPageSchemaWithMonitors>) {
    setSaving(true);
    // await api.monitor.getMonitorsByWorkspace.revalidate();
    await api.page.createPage.mutate({ ...props, workspaceId });
    router.refresh();
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Create</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-screen flex-col">
        <DialogHeader>
          <DialogTitle>Create Status Page</DialogTitle>
          <DialogDescription>Choose the settings.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-scroll px-1">
          <StatusPageForm
            id="status-page-create"
            onSubmit={onCreate}
            allMonitors={allMonitors}
          />
        </div>
        <DialogFooter>
          <Button type="submit" form="status-page-create" disabled={saving}>
            {!saving ? "Confirm" : <LoadingAnimation />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
