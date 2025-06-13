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
import { Button } from "@/components/ui/button";
import { type NotifierProvider, config } from "@/data/notifiers.client";
import { useState } from "react";
import type { FormValues } from "./form";

export function FormSheetNotifier({
  children,
  id,
}: React.ComponentProps<typeof FormSheetTrigger> & {
  defaultValues?: FormValues;
  id?: NotifierProvider;
}) {
  const [open, setOpen] = useState(false);
  const Form = id ? config[id].form : undefined;
  return (
    <FormSheet open={open} onOpenChange={setOpen}>
      <FormSheetTrigger asChild>{children}</FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Notifier</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the notifier.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto border-none">
            <FormCardContent>
              {Form && (
                <Form
                  id={`notifier-form-${id}`}
                  className="my-4"
                  onSubmit={() => setOpen(false)}
                  // defaultValues={defaultValues}
                />
              )}
            </FormCardContent>
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          {/* TODO: add updatedAt footer info if defaultValues is provided */}
          <Button type="submit" form={`notifier-form-${id}`}>
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
