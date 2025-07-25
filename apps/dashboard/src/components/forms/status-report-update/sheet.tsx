"use client";

import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
} from "@/components/forms/form-sheet";
import {
  FormStatusReportUpdate,
  type FormValues,
} from "@/components/forms/status-report-update/form";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function FormSheetStatusReportUpdate({
  children,
  defaultValues,
  onSubmit,
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <FormSheet open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Status Report Update</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the status of your report.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-scroll">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormStatusReportUpdate
              id="status-report-update-form"
              className="my-4"
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              defaultValues={defaultValues}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="status-report-update-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
