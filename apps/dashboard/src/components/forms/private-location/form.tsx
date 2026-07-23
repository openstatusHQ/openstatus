"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { Check, Copy, Plus, X } from "lucide-react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { CheckboxTree } from "@/components/ui/checkbox-tree";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  token: z.string(),
  monitors: z.array(z.number()),
  metadata: z
    .array(
      z.object({
        key: z.string().min(1, "Key is required").max(64),
        value: z.string().max(256),
      }),
    )
    .max(20, "At most 20 metadata entries")
    .refine(
      (rows) => new Set(rows.map((r) => r.key)).size === rows.length,
      "Metadata keys must be unique",
    ),
});

export type FormValues = z.infer<typeof schema>;

export function FormPrivateLocation({
  defaultValues,
  onSubmit,
  className,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  monitors: { id: number; name: string; url: string }[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      token: crypto.randomUUID(),
      monitors: [],
      metadata: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const { copy, isCopied } = useCopyToClipboard();
  const { setIsDirty } = useFormSheetDirty();

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to save";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormCardContent>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Raspberry Pi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Token</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupInput
                      placeholder="Private Location Token"
                      readOnly
                      value={field.value}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label="Copy"
                        title="Copy"
                        size="icon-xs"
                        onClick={() => {
                          copy(field.value, {
                            successMessage: "Token copied to clipboard",
                          });
                        }}
                      >
                        {isCopied ? <Check /> : <Copy />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="monitors"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Connected monitors will be automatically activated for the
                  private location.
                </FormDescription>
                {monitors.length ? (
                  <FormControl>
                    <CheckboxTree
                      items={[
                        {
                          id: -1,
                          label: "Select all",
                          children: monitors.map((m) => ({
                            id: m.id,
                            label: m.name,
                          })),
                        },
                      ]}
                      value={field.value ?? []}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                ) : (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No monitors found</EmptyStateTitle>
                  </EmptyStateContainer>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="metadata"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Metadata</FormLabel>
                <FormDescription>
                  Optional key/value labels to store custom information about
                  this location.
                </FormDescription>
                {field.value.map((entry, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-5">
                    <Input
                      placeholder="Key"
                      className="col-span-2"
                      value={entry.key}
                      onChange={(e) => {
                        const next = [...field.value];
                        next[index] = { ...next[index], key: e.target.value };
                        field.onChange(next);
                      }}
                    />
                    <Input
                      placeholder="Value"
                      className="col-span-2"
                      value={entry.value}
                      onChange={(e) => {
                        const next = [...field.value];
                        next[index] = { ...next[index], value: e.target.value };
                        field.onChange(next);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      aria-label="Remove metadata entry"
                      onClick={() => {
                        field.onChange(
                          field.value.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={field.value.length >= 20}
                    onClick={() => {
                      field.onChange([...field.value, { key: "", value: "" }]);
                    }}
                  >
                    <Plus />
                    Add Metadata
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
