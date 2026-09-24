"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useState } from "react";

import { FormCard, FormCardGroup } from "@/components/forms/form-card";
import {
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetFooterInfo,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetTrigger,
  FormSheetWithDirtyProtection,
} from "@/components/forms/form-sheet";
import {
  FormMaintenance,
  type FormValues,
} from "@/components/forms/maintenance/form";
import type { CheckboxTreeItem } from "@/components/ui/checkbox-tree";
import { formatDateTime } from "@/lib/formatter";

export function FormSheetMaintenance({
  children,
  defaultValues,
  updatedAt,
  onSubmit,
  items,
  ...props
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  updatedAt?: Date | null;
  items: CheckboxTreeItem[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <FormSheetWithDirtyProtection open={open} onOpenChange={setOpen}>
      <FormSheetTrigger {...props} asChild>
        {children}
      </FormSheetTrigger>
      <FormSheetContent className="sm:max-w-lg">
        <FormSheetHeader>
          <FormSheetTitle>Maintenance</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the maintenance.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormMaintenance
              items={items}
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
          {updatedAt ? (
            <FormSheetFooterInfo>
              Last Updated{" "}
              <time dateTime={updatedAt.toISOString()}>
                {formatDateTime(updatedAt)}
              </time>
            </FormSheetFooterInfo>
          ) : null}
          <Button type="submit" form="maintenance-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
