"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { DataTable } from "@/components/data-table/settings/api-key/data-table";
import { CreateApiKeyDialog } from "@/components/forms/api-key/dialog";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";

// we should prefetch the api key on the server (layout)

export function FormApiKey() {
  const trpc = useTRPC();
  const { data: apiKeys = [] } = useQuery(trpc.apiKey.list.queryOptions());

  return (
    <FormCard id="api-keys">
      <FormCardHeader>
        <FormCardTitle>API Keys</FormCardTitle>
        <FormCardDescription>
          Create and manage your API keys.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        <DataTable apiKeys={apiKeys} />
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Keys carry read or write access per resource. Read about{" "}
          <Link
            href="https://www.openstatus.dev/docs/sdk/nodejs/authentication#scopes"
            rel="noreferrer"
            target="_blank"
          >
            scopes
          </Link>{" "}
          or browse the{" "}
          <Link
            href="https://api.openstatus.dev/openapi"
            rel="noreferrer"
            target="_blank"
          >
            API reference
          </Link>
          .
        </FormCardFooterInfo>
        <CreateApiKeyDialog>
          <Button size="sm">Create</Button>
        </CreateApiKeyDialog>
      </FormCardFooter>
    </FormCard>
  );
}
