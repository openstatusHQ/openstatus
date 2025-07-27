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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// we should prefetch the api key on the server (layout)

export function FormApiKey() {
  const trpc = useTRPC();
  const [isPending, startTransition] = useTransition();
  const { copy } = useCopyToClipboard();
  const [result, setResult] = useState<{
    keyId: string;
    key: string;
  } | null>(null);
  const { data: workspace } = useQuery(
    trpc.workspace.getWorkspace.queryOptions(),
  );
  const { data: apiKey, refetch } = useQuery(trpc.apiKey.get.queryOptions());
  const createApiKeyMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (data) => {
        if (data.result) {
          setResult(data.result);
        } else {
          throw new Error("Failed to create API key");
        }
      },
    }),
  );
  const revokeApiKeyMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  async function createAction() {
    if (isPending || !workspace) return;

    startTransition(async () => {
      try {
        const promise = createApiKeyMutation.mutateAsync({
          ownerId: workspace.id,
        });
        toast.promise(promise, {
          loading: "Creating...",
          success: () => "Created",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to create API key";
          },
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
        {!apiKey ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No API key</EmptyStateTitle>
            <EmptyStateDescription>
              Access your data via API.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <DataTable apiKey={apiKey} />
        )}
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Trigger monitors via CLI, CI/CD or create your own status page.{" "}
          <Link
            href="https://api.openstatus.dev/v1"
            rel="noreferrer"
            target="_blank"
          >
            Learn more
          </Link>
          .
        </FormCardFooterInfo>
        {!apiKey ? (
          <Button size="sm" onClick={createAction}>
            Create
          </Button>
        ) : (
          <FormAlertDialog
            title="API Key"
            confirmationValue="delete api key"
            submitAction={async () => {
              await revokeApiKeyMutation.mutateAsync({
                keyId: apiKey.id,
              });
            }}
          />
        )}
      </FormCardFooter>
      <AlertDialog open={!!result} onOpenChange={() => setResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Ensure you copy your API key before closing this dialog. You will
              not see it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
            <code className="flex-1 font-mono text-sm">{result?.key}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                copy(result?.key || "", { withToast: true });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <Button
              onClick={() => {
                refetch();
                setResult(null);
              }}
            >
              Done
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  );
}
