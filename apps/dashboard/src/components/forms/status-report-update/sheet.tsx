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
  FormStatusReportUpdate,
  type FormValues,
} from "@/components/forms/status-report-update/form";

export function FormSheetStatusReportUpdate({
  children,
  defaultValues,
  onSubmit,
  components,
  allowUnsetImpacts,
  open: controlledOpen,
  onOpenChange,
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  components?: { id: number; name: string }[];
  allowUnsetImpacts?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      {children ? (
        <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      ) : null}
      <FormSheetContent className="sm:max-w-lg">
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
              components={components}
              allowUnsetImpacts={allowUnsetImpacts}
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="status-report-update-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
