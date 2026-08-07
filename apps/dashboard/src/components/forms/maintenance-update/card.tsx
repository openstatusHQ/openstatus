"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";

import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import {
  FormCard,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import {
  FormMaintenanceUpdate,
  type FormValues,
} from "@/components/forms/maintenance-update/form";

type MaintenanceUpdate = RouterOutputs["maintenance"]["get"]["updates"][number];

export function FormMaintenanceUpdateCard({
  index,
  total,
  update,
  onSubmit,
  onDelete,
}: {
  index: number;
  total: number;
  update: MaintenanceUpdate;
  onSubmit: (values: FormValues) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const formId = `maintenance-update-${update.id}`;
  const title = `Maintenance Update #${total - index}`;

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>{title}</FormCardTitle>
      </FormCardHeader>
      <FormMaintenanceUpdate
        id={formId}
        defaultValues={{ message: update.message, date: update.date }}
        onSubmit={onSubmit}
      />
      <FormCardFooter className="flex items-center justify-end gap-2 *:last:ml-0">
        {total > 1 ? (
          <FormAlertDialog confirmationValue={title} submitAction={onDelete}>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Delete
            </Button>
          </FormAlertDialog>
        ) : null}
        <Button type="submit" form={formId}>
          Submit
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
