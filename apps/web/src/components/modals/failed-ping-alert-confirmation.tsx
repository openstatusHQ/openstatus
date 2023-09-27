import * as React from "react";

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
import type { MonitorProps } from "../forms/montitor-form";

type FailedPingAlertConfirmationProps = {
  submit: ({ ...props }: MonitorProps) => void;
  props: MonitorProps;
  pingFailed: boolean;
  setPingFailed: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  handleDataInsertion: (props: MonitorProps) => void;
};

export const FailedPingAlertConfirmation = ({
  loading,
  handleDataInsertion,
  pingFailed,
  setPingFailed,
  ...props
}: FailedPingAlertConfirmationProps) => {
  const handleSubmit = () => {
    handleDataInsertion(props.props);
    setPingFailed(false);
  };

  return (
    <AlertDialog
      open={pingFailed}
      onOpenChange={(value) => setPingFailed(value)}
    >
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
            disabled={loading}
            onClick={handleSubmit}
          >
            {!loading ? "Confirm" : <LoadingAnimation />}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
