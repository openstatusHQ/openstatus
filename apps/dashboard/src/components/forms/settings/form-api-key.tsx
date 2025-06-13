"use client";

import { Link } from "@/components/common/link";
import {
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateContainer } from "@/components/content/empty-state";
import { DataTable } from "@/components/data-table/settings/api-key/data-table";
import { FormAlertDialog } from "@/components/forms/form-alert-dialog";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";

const EMPTY = false;

export function FormApiKey() {
  const [isPending, startTransition] = useTransition();

  function createAction() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        toast.promise(promise, {
          loading: "Creating...",
          success: () => "API key created",
          error: "Failed to create API key",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>API Key</FormCardTitle>
        <FormCardDescription>
          Create and revoke your API key.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {EMPTY ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No API key</EmptyStateTitle>
            <EmptyStateDescription>
              Access your data via API.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <DataTable />
        )}
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Trigger monitors via CLI, CI/CD or create your own status page.{" "}
          <Link href="#">Learn more</Link>.
        </FormCardFooterInfo>
        {EMPTY ? (
          <Button size="sm" onClick={createAction}>
            Create
          </Button>
        ) : (
          <FormAlertDialog title="API Key" confirmationValue="delete api key" />
        )}
      </FormCardFooter>
    </FormCard>
  );
}
