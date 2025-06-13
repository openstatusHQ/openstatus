"use client";

import { Button } from "@/components/ui/button";
import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormStatusReport,
  type FormValues,
} from "@/components/forms/status-report/form";
import { useState } from "react";
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

export function FormSheetStatusReport({
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
          <FormSheetTitle>Status Report Update</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the status of your report.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-scroll">
          <FormCard className="overflow-auto border-none">
            <FormStatusReport
              id="status-report-form"
              className="my-4"
              onSubmit={() => setOpen(false)}
              defaultValues={defaultValues}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          {defaultValues ? (
            <FormSheetFooterInfo>
              Last Updated <time>{defaultValues.date.toLocaleString()}</time>
            </FormSheetFooterInfo>
          ) : null}
          <Button type="submit" form="status-report-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
