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

import { NotificationForm } from "@/components/forms/notification-form";

export const NotificationDialog = ({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(val) => setOpen(val)}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          Add Notifications
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Notification</DialogTitle>
          <DialogDescription>
            Get alerted when your endpoint is down.
          </DialogDescription>
        </DialogHeader>
        <NotificationForm
          onSubmit={() => setOpen(false)}
          {...{ workspaceSlug }}
        />
      </DialogContent>
    </Dialog>
  );
};
