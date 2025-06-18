"use client";

import {
  FormCard,
  FormCardContent,
  FormCardGroup,
} from "@/components/forms/form-card";
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
  FormMonitorTag,
  type FormValues,
} from "@/components/forms/monitor-tag/form-monitor-tag";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function FormSheetMonitorTag({
  children,
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
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
          <FormSheetTitle>Monitor Tag</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the monitor tag.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto flex-1">
          <FormCard className="overflow-auto border-none rounded-none flex-1">
            <FormCardContent>
              <FormMonitorTag
                onSubmit={onSubmit}
                defaultValues={defaultValues}
                id="tags-form"
                className="my-4"
              />
            </FormCardContent>
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="tags-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
