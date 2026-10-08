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
import {
  FormMaintenanceUpdate,
  type FormValues,
} from "@/components/forms/maintenance-update/form";

export function FormSheetMaintenanceUpdate({
  children,
  defaultValues,
  onSubmit,
  open: controlledOpen,
  onOpenChange,
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      {children ? (
        <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      ) : null}
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Maintenance Update</FormSheetTitle>
          <FormSheetDescription>
            Edit the message or date of this update.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormMaintenanceUpdate
              id="maintenance-update-form"
              className="my-4"
              defaultValues={defaultValues}
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="maintenance-update-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
