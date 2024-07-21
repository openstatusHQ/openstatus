"use client";

import { useRouter } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";

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
  AlertDialogTrigger,
  Button,
  Checkbox,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import React from "react";
import { SectionHeader } from "../shared/section-header";

interface Props {
  monitorId: number;
  form: UseFormReturn<InsertMonitor>;
}

export function SectionDanger({ monitorId, form }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  async function onDelete() {
    startTransition(async () => {
      try {
        await api.monitor.delete.mutate({ id: monitorId });
        toastAction("deleted");
        setOpen(false);
        router.push("/app");
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Danger Zone"
        description="Be aware of the changes you are about to make."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="public"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 sm:col-span-2">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Allow public monitor</FormLabel>
                <FormDescription>
                  Change monitor visibility. When checked, the monitor stats
                  from the overview page will be public. You will be able to
                  share it via a connected status page or{" "}
                  <code className="underline underline-offset-4">
                    openstatus.dev/public/monitors/{form.getValues("id")}
                  </code>
                  .
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <div className="col-start-1 flex flex-col items-center gap-4 sm:col-span-2 sm:flex-row">
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  monitor.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {!isPending ? "Delete" : <LoadingAnimation />}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <FormDescription className="order-1 text-red-500 sm:order-2">
            This action cannot be undone. This will permanently delete the
            monitor.
          </FormDescription>
        </div>
      </div>
    </div>
  );
}
