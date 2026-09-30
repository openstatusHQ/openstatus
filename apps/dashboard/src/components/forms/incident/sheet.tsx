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
  type DeclareIncidentValues,
  FormDeclareIncident,
  type FormValues,
} from "./form";

export function FormSheetDeclareIncident({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultValues,
  onSubmit,
  footer,
  slack,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: DeclareIncidentValues) => Promise<void>;
  footer?: React.ReactNode;
  slack: "ready" | "reconnect" | "disconnected";
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
          <FormSheetTitle>Declare incident</FormSheetTitle>
          <FormSheetDescription>
            An internal record for the team: severity, commander and a timeline.
            Nothing is published until you create a status report.
          </FormSheetDescription>
        </FormSheetHeader>
        <FormCardGroup className="overflow-y-scroll">
          <FormCard className="overflow-auto rounded-none border-none">
            <FormDeclareIncident
              id="declare-incident-form"
              className="my-4"
              defaultValues={defaultValues}
              slack={slack}
              onSubmit={async (values) => {
                await onSubmit(values);
                setOpen(false);
              }}
            />
          </FormCard>
        </FormCardGroup>
        {footer}
        <FormSheetFooter>
          <Button type="submit" form="declare-incident-form">
            Declare
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
    </FormSheetWithDirtyProtection>
  );
}
