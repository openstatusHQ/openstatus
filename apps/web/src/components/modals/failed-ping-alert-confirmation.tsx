import React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import type { MonitorProps } from "../forms/monitor-form";

type FailedPingAlertConfirmationProps = {
  monitor: MonitorProps;
  pingFailed: boolean;
  setPingFailed: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: (props: MonitorProps) => Promise<void>;
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
