"use client";

import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetFooterInfo,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
} from "@/components/forms/form-sheet";
import {
  FormMaintenance,
  type FormValues,
} from "@/components/forms/maintenance/form";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function FormSheetMaintenance({
  children,
  defaultValues,
  onSubmit,
  monitors,
  ...props
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  monitors: { id: number; name: string; url: string }[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <FormSheet open={open} onOpenChange={setOpen}>
      <FormSheetTrigger {...props} asChild>
        {children}
      </FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Maintenance</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the maintenance.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto border-none rounded-none">
            <FormMaintenance
              monitors={monitors}
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              defaultValues={defaultValues}
              id="maintenance-form"
              className="my-4"
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          {defaultValues ? (
            <FormSheetFooterInfo>
              Last Updated {/* TODO: use updatedAt */}
              <time>{defaultValues.startDate.toLocaleString()}</time>
            </FormSheetFooterInfo>
          ) : null}
          <Button type="submit" form="maintenance-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
