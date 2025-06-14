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
}: React.ComponentProps<typeof FormSheetTrigger> & {
  defaultValues?: FormValues;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FormSheet open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Maintenance</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the maintenance.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto border-none">
            <FormMaintenance
              onSubmit={() => setOpen(false)}
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
