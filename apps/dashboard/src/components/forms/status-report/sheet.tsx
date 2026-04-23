"use client";

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
  FormStatusReport,
  type FormValues,
} from "@/components/forms/status-report/form";
import type { CheckboxTreeItem } from "@/components/ui/checkbox-tree";
import { Button } from "@openstatus/ui/components/ui/button";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useState } from "react";

export function FormSheetStatusReport({
  children,
  defaultValues,
  onSubmit,
  items,
  warning,
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  items: CheckboxTreeItem[];
  warning?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Status Report</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the status of your report.
          </FormSheetDescription>
        </FormSheetHeader>
        {warning ? (
          <>
            <p className="px-4 py-4 text-sm text-warning">{warning}</p>
            <Separator />
          </>
        ) : null}
        <FormCardGroup className="overflow-y-scroll">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormStatusReport
              id="status-report-form"
              className="my-4"
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              defaultValues={defaultValues}
              items={items}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="status-report-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
