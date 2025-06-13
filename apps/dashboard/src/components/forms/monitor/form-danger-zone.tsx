"use client";

import {
  FormCard,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { FormAlertDialog } from "@/components/forms/form-alert-dialog";

export function FormDangerZone() {
  return (
    <FormCard variant="destructive">
      <FormCardHeader>
        <FormCardTitle>Danger Zone</FormCardTitle>
        <FormCardDescription>This action cannot be undone.</FormCardDescription>
      </FormCardHeader>
      <FormCardFooter variant="destructive" className="justify-end">
        <FormAlertDialog
          title="OpenStatus API"
          confirmationValue="delete monitor"
        />
      </FormCardFooter>
    </FormCard>
  );
}
