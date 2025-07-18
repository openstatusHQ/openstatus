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
  FormStatusReport,
  type FormValues,
} from "@/components/forms/status-report/form";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";

export function FormSheetStatusReport({
  children,
  defaultValues,
  onSubmit,
  monitors,
  warning,
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  monitors: { id: number; name: string }[];
  warning?: string;
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
        {warning ? (
          <>
            <p className="text-sm text-warning px-4 py-4">{warning}</p>
            <Separator />
          </>
        ) : null}
        <FormCardGroup className="overflow-y-scroll">
          <FormCard className="overflow-auto border-none rounded-none">
            <FormStatusReport
              id="status-report-form"
              className="my-4"
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              defaultValues={defaultValues}
              monitors={monitors}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="status-report-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
