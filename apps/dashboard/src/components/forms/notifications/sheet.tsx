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
import { Button } from "@/components/ui/button";
import { config } from "@/data/notifications.client";
import { useState } from "react";
import type { FormValues } from "./form";

export function FormSheetNotifier({
  children,
  defaultValues,
  provider,
  onSubmit,
  monitors,
  defaultOpen,
  ...props
}: Omit<React.ComponentProps<typeof FormSheetTrigger>, "onSubmit"> & {
  defaultValues?: FormValues;
  provider: FormValues["provider"];
  onSubmit?: (values: FormValues) => Promise<void>;
  monitors: { id: number; name: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const Form = provider ? config[provider].form : undefined;

  return (
    <FormSheet open={open} onOpenChange={setOpen}>
      <FormSheetTrigger {...props} asChild>
        {children}
      </FormSheetTrigger>
      <FormSheetContent>
        <FormSheetHeader>
          <FormSheetTitle>Notifier</FormSheetTitle>
          <FormSheetDescription>
            Configure and update the notifier.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-auto">
          <FormCard className="overflow-auto border-none rounded-none">
            {Form && (
              <Form
                id={`notifier-form-${provider}`}
                className="my-4"
                onSubmit={async (values) => {
                  await onSubmit?.(values);
                  setOpen(false);
                }}
                // @ts-expect-error - defaultValues is not defined in the form component
                defaultValues={
                  defaultValues
                    ? {
                        ...defaultValues,
                        data:
                          typeof defaultValues?.data === "string"
                            ? defaultValues?.data
                            : defaultValues?.data?.[provider],
                      }
                    : undefined
                }
                monitors={monitors}
              />
            )}
          </FormCard>
        </FormCardGroup>
        <FormSheetFooter>
          <Button type="submit" form={`notifier-form-${provider}`}>
            Submit
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheet>
  );
}
