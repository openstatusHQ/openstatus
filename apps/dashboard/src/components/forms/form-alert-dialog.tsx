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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isTRPCClientError } from "@trpc/client";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface FormAlertDialogProps {
  title: string;
  confirmationValue: string;
  submitAction: () => Promise<void>;
  children?: React.ReactNode;
}

export function FormAlertDialog({
  title,
  confirmationValue,
  submitAction,
  children,
}: FormAlertDialogProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
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
      console.error("Failed to delete:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children ?? <Button variant="destructive">Delete</Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure about deleting `{title}`?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently remove the entry
            from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form id="form-alert-dialog" className="space-y-0.5">
          <p className="text-muted-foreground text-xs">
            Please write &apos;
            <span className="font-semibold">{confirmationValue}</span>
            &apos; to confirm
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
