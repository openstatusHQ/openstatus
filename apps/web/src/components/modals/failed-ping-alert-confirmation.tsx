"use client";

import React from "react";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/src/components/alert-dialog";

import { LoadingAnimation } from "@/components/loading-animation";

type FailedPingAlertConfirmationProps = {
  monitor: InsertMonitor;
  pingFailed: boolean;
  setPingFailed: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: (props: InsertMonitor) => Promise<void>;
};

export const FailedPingAlertConfirmation = ({
  onConfirm: upsertMonitor,
  pingFailed,
  setPingFailed,
  monitor,
}: FailedPingAlertConfirmationProps) => {
  const [isPending, startTransition] = React.useTransition();
  const handleSubmit = () => {
    startTransition(async () => {
      await upsertMonitor(monitor);
      setPingFailed(false);
    });
  };

  return (
    <AlertDialog open={pingFailed} onOpenChange={setPingFailed}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            The test ping failed. Are you sure you want to continue to save?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="submit"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
