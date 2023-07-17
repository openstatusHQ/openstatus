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

interface Props {
  workspaceId: number;
}

export function CreateForm({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onCreate(values: z.infer<typeof insertMonitorSchema>) {
    setSaving(true);
    // await api.monitor.getMonitorsByWorkspace.revalidate();
    await api.monitor.createMonitor.mutate({ ...values, workspaceId });
    router.refresh();
    setSaving(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        <Button>Create</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Monitor</DialogTitle>
          <DialogDescription>Choose the settings.</DialogDescription>
        </DialogHeader>
        <MonitorForm id="monitor-create" onSubmit={onCreate} />
        <DialogFooter>
          <Button type="submit" form="monitor-create" disabled={saving}>
            {!saving ? "Confirm" : <LoadingAnimation />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
