"use client";

import { Link } from "@/components/common/link";
import {
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateContainer } from "@/components/content/empty-state";
import { DataTable } from "@/components/data-table/settings/api-key/data-table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    token: string;
    key: string;
  } | null>(null);
  // Should use react hookform ?
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: workspace } = useQuery(
    trpc.workspace.getWorkspace.queryOptions(),
  );
  const { data: apiKeys = [], refetch } = useQuery(
    trpc.apiKeyRouter.getAll.queryOptions(),
  );
  const createApiKeyMutation = useMutation(
    trpc.apiKeyRouter.create.mutationOptions({
      onSuccess: (data) => {
        if (data) {
          setResult({ token: data.token, key: data.key.name });
          setCreateDialogOpen(false);
          // Reset form
          setName("");
          setDescription("");
          setExpiresAt("");
        } else {
          throw new Error("Failed to create API key");
        }
      },
    }),
  );

  async function createAction() {
    if (isPending || !workspace || !name.trim()) {
      if (!name.trim()) {
        toast.error("Name is required");
      }
      return;
    }

    startTransition(async () => {
      try {
        const promise = createApiKeyMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          // expiresAt: new Date(),
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
        <FormCardTitle>API Keys</FormCardTitle>
        <FormCardDescription>
          Create and manage your API keys.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {apiKeys.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No API keys</EmptyStateTitle>
            <EmptyStateDescription>
              Access your data via API.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <DataTable apiKeys={apiKeys} refetch={refetch} />
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
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Create</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to access your workspace data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Production API"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Used for production deployment"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={createAction}
                disabled={isPending || !name.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FormCardFooter>
      <AlertDialog open={!!result} onOpenChange={() => setResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API Key Created</AlertDialogTitle>
            <AlertDialogDescription>
              Ensure you copy your API key before closing this dialog. You will
              not see it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
            <code className="flex-1 break-all font-mono text-sm">
              {result?.token}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                copy(result?.token || "", { withToast: true });
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
