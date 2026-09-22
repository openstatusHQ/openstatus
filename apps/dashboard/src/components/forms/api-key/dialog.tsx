"use client";

import { Check, Copy } from "@openstatus/icons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui/components/ui/dialog";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { ApiKeyForm, type FormValues } from "./form";

export function CreateApiKeyDialog({
  children,
  defaultScope = "read",
}: {
  children: React.ReactNode;
  defaultScope?: FormValues["scope"];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { copy, isCopied } = useCopyToClipboard();
  const [result, setResult] = useState<{
    token: string;
    key: string;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const createApiKeyMutation = useMutation(
    trpc.apiKey.create.mutationOptions(),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent
          className="max-h-[80vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.body.style.pointerEvents = "";
          }}
        >
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to access your workspace data.
            </DialogDescription>
          </DialogHeader>
          <ApiKeyForm
            defaultValues={{ scope: defaultScope }}
            submitDisabled={!workspace}
            onCancel={() => setOpen(false)}
            onSubmit={async (values) => {
              const data = await createApiKeyMutation.mutateAsync({
                name: values.name.trim(),
                description: values.description?.trim() || undefined,
                expiresAt: values.expiresAt
                  ? new Date(values.expiresAt)
                  : undefined,
                scopes: [values.scope],
              });
              if (!data) {
                throw new Error("Failed to create API key");
              }
              queryClient.invalidateQueries({
                queryKey: trpc.apiKey.list.queryKey(),
              });
              setResult({ token: data.token, key: data.key.name });
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!result} onOpenChange={() => setResult(null)}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.body.style.pointerEvents = "";
          }}
        >
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
    </>
  );
}
