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
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { isTRPCClientError } from "@trpc/client";
import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface FormAlertDialogProps {
  confirmationValue: string;
  submitAction: () => Promise<void>;
  children?: React.ReactNode;
}

export function FormAlertDialog({
  confirmationValue,
  submitAction,
  children,
}: FormAlertDialogProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const { copy, isCopied } = useCopyToClipboard();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      startTransition(async () => {
        const promise = submitAction();
        toast.promise(promise, {
          loading: "Deleting...",
          success: "Deleted",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to delete";
          },
        });
        await promise;
        setOpen(false);
      });
    } catch (error) {
      console.error("Failed to revoke:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children ?? (
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure about delete `{confirmationValue}`?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the item.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form id="form-alert-dialog" className="space-y-1.5">
          <p className="text-muted-foreground text-sm">
            Type{" "}
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="font-normal [&_svg]:size-3"
              onClick={() => copy(confirmationValue, { withToast: false })}
            >
              {confirmationValue}
              {isCopied ? <Check /> : <Copy />}
            </Button>{" "}
            to confirm
          </p>
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
            disabled={value !== confirmationValue || isPending}
            form="form-alert-dialog"
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
