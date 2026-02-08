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
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { Calendar } from "@openstatus/ui/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import { CalendarIcon, Check, Copy } from "lucide-react";
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
  const { copy, isCopied } = useCopyToClipboard();
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
          refetch();
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Expiration Date</FormLabel>
                        <Popover modal>
                          <FormControl>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "w-[240px] pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                          </FormControl>
                          <PopoverContent
                            className="pointer-events-auto w-auto p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={(date) => {
                                if (!date) {
                                  field.onChange("");
                                  return;
                                }
                                // Convert to ISO string and take only the date part (YYYY-MM-DD)
                                const dateString = date
                                  .toISOString()
                                  .split("T")[0];
                                field.onChange(dateString);
                              }}
                              disabled={(date) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const compareDate = new Date(date);
                                compareDate.setHours(0, 0, 0, 0);
                                return compareDate < today;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                copy(result?.token || "", {
                  successMessage: "Copied API key to clipboard",
                });
              }}
            >
              <code>{result?.token}</code>
              {isCopied ? (
                <Check size={16} className="text-muted-foreground" />
              ) : (
                <Copy size={16} className="text-muted-foreground" />
              )}
            </Button>
          </div>
          <AlertDialogFooter>
            <Button onClick={() => setResult(null)}>Done</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormCard>
  );
}
