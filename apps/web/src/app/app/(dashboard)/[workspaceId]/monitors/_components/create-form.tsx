"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type * as z from "zod";

import type { insertMonitorSchema } from "@openstatus/db/src/schema";

import { MonitorForm } from "@/components/forms/montitor-form";
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

type MonitorSchema = z.infer<typeof insertMonitorSchema>;

interface Props {
  workspaceId: string;
}

export function CreateForm({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onCreate(values: MonitorSchema) {
    setSaving(true);
    // await api.monitor.getMonitorsByWorkspace.revalidate();
    await api.monitor.createMonitor.mutate({
      data: values,
      workspaceSlug: workspaceId,
    });
    router.refresh();
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-screen flex-col">
        <DialogHeader>
          <DialogTitle>Create Monitor</DialogTitle>
          <DialogDescription>Choose the settings.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-scroll px-1">
          <MonitorForm id="monitor-create" onSubmit={onCreate} />
        </div>
        <DialogFooter>
          <Button type="submit" form="monitor-create" disabled={saving}>
            {!saving ? "Confirm" : <LoadingAnimation />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
