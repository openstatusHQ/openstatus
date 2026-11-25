"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
  FormSheetWithDirtyProtection,
} from "@/components/forms/form-sheet";

import { FormMaintenanceWindow, type FormValues } from "./form";

export function FormSheetMaintenanceWindow({
  children,
  defaultValues,
  monitors,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
  ...props
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  monitors: React.ComponentProps<typeof FormMaintenanceWindow>["monitors"];
  onSubmit: (values: FormValues) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      {children ? (
        <FormSheetTrigger {...props} asChild>
          {children}
        </FormSheetTrigger>
      ) : null}
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Maintenance window</FormSheetTitle>
          <FormSheetDescription>
            Planned work on monitors: pause their checks, or keep checking
            without status changes or alerts.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormMaintenanceWindow
              // remount per open so defaults follow the row being edited
              key={open ? "open" : "closed"}
              monitors={monitors}
              defaultValues={defaultValues}
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              id="maintenance-window-form"
              className="my-4"
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="maintenance-window-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
