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
  FormPrivateLocation,
  type FormValues,
} from "@/components/forms/private-location/form";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function FormSheetPrivateLocation({
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
          <FormSheetTitle>Private Location</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the private location.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormPrivateLocation
              monitors={monitors}
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
              defaultValues={defaultValues}
              id="private-location-form"
              className="my-4"
            />
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form="private-location-form">
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
