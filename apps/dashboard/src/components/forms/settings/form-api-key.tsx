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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// we should prefetch the api key on the server (layout)

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function FormApiKey() {
  const trpc = useTRPC();
  const [isPending, startTransition] = useTransition();
  const { copy } = useCopyToClipboard();
  const [result, setResult] = useState<{
    token: string;
    key: string;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      expiresAt: "",
    },
  });

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
          form.reset();
        } else {
          throw new Error("Failed to create API key");
        }
      },
    }),
  );

  function createAction(values: FormValues) {
    if (isPending || !workspace) {
      return;
    }

    startTransition(async () => {
      try {
        const promise = createApiKeyMutation.mutateAsync({
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          expiresAt: values.expiresAt ? new Date(values.expiresAt) : undefined,
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(createAction)}>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key to access your workspace data.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Production API" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Used for production deployment"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="mt-4">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
