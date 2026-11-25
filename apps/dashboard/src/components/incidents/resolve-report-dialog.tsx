"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { usePublishUpdate } from "@/components/status-reports/use-publish-update";
import { errorMessage } from "@/lib/trpc/error";

/**
 * Offered after an incident is resolved or canceled while its status report
 * is still open. Nothing is posted unless the user confirms the text.
 */
export function ResolveReportDialog({
  report,
  defaultMessage,
  canNotify,
  open,
  onOpenChange,
}: {
  report: { id: number; title: string };
  defaultMessage: string;
  canNotify: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const [notifySubscribers, setNotifySubscribers] = useState(canNotify);
  const update = usePublishUpdate(report.id);

  useEffect(() => {
    if (open) setMessage(defaultMessage);
  }, [open, defaultMessage]);

  async function submit() {
    const promise = update.publish({
      statusReportId: report.id,
      status: "resolved",
      message,
      date: new Date(),
      notifySubscribers,
    });
    toast.promise(promise, {
      loading: "Resolving status report...",
      success: "Status report resolved",
      error: (error) => errorMessage(error, "Failed to resolve"),
    });
    await promise;
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolve the status report too?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{report.title}</strong> is still open on your status page.
            Edit the public message below, or keep the report open.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {canNotify ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="resolve-report-notify"
              checked={notifySubscribers}
              onCheckedChange={(checked) =>
                setNotifySubscribers(checked === true)
              }
            />
            <Label htmlFor="resolve-report-notify">Notify subscribers</Label>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it open</AlertDialogCancel>
          <AlertDialogAction
            disabled={!message.trim() || update.isPending}
            onClick={(e) => {
              e.preventDefault();
              submit().catch(console.error);
            }}
          >
            Post resolved update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
