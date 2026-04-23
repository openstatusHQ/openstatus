"use client";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import {
  CheckboxTree,
  type CheckboxTreeItem,
} from "@/components/ui/checkbox-tree";
import { zodResolver } from "@hookform/resolvers/zod";
import { detectWebhookFlavor } from "@openstatus/subscriptions/client";
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
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { Plus, X } from "lucide-react";
import React, { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const headerSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

// Form schema: a single flat shape with optional fields. The submit handler
// narrows to email-only or webhook-only payload based on `channelType`.
const formSchema = z
  .object({
    channelType: z.enum(["email", "webhook"]),
    name: z.string().max(255),
    email: z.string(),
    webhookUrl: z.string(),
    headers: z.array(headerSchema),
    componentIds: z.array(z.number()),
  })
  .superRefine((data, ctx) => {
    if (data.channelType === "email") {
      const result = z.email().safeParse(data.email);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["email"],
          message: "Please enter a valid email",
        });
      }
    } else {
      const result = z.url().safeParse(data.webhookUrl);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          path: ["webhookUrl"],
          message: "Please enter a valid URL",
        });
      } else if (detectWebhookFlavor(data.webhookUrl) === "generic") {
        ctx.addIssue({
          code: "custom",
          path: ["webhookUrl"],
          message: "Only Slack and Discord webhook URLs are supported.",
        });
      }
    }
  });

export type SubscriberFormValues = z.infer<typeof formSchema>;

export type SubmitPayload =
  | {
      channelType: "email";
      name: string;
      email: string;
      componentIds: number[];
    }
  | {
      channelType: "webhook";
      name: string;
      webhookUrl: string;
      headers: { key: string; value: string }[];
      componentIds: number[];
    };

function toPayload(values: SubscriberFormValues): SubmitPayload {
  if (values.channelType === "email") {
    return {
      channelType: "email",
      name: values.name,
      email: values.email,
      componentIds: values.componentIds,
    };
  }
  return {
    channelType: "webhook",
    name: values.name,
    webhookUrl: values.webhookUrl,
    headers: values.headers,
    componentIds: values.componentIds,
  };
}

const emptyDefaults: SubscriberFormValues = {
  channelType: "email",
  name: "",
  email: "",
  webhookUrl: "",
  headers: [],
  componentIds: [],
};

export function FormSubscriber({
  defaultValues,
  onSubmit,
  className,
  items,
  editMode = false,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<SubscriberFormValues>;
  items: CheckboxTreeItem[];
  onSubmit: (values: SubmitPayload) => Promise<void>;
  /** When true, channel type is locked (editing an existing subscriber). */
  editMode?: boolean;
}) {
  const form = useForm<SubscriberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const channelType = form.watch("channelType");
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "headers",
  });

  function submitAction(values: SubscriberFormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(toPayload(values));
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
            name="channelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel</FormLabel>
                <FormControl>
                  <Tabs
                    value={field.value}
                    onValueChange={(v) => {
                      if (editMode) return;
                      if (v === "email" || v === "webhook") {
                        field.onChange(v);
                      }
                    }}
                  >
                    <TabsList>
                      <TabsTrigger value="email" disabled={editMode}>
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="webhook" disabled={editMode}>
                        Webhook
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display label (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      channelType === "webhook"
                        ? "Supabase #incidents"
                        : "Alice (Partner CTO)"
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Shown in place of the raw destination in the dashboard.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        {channelType === "email" ? (
          <FormCardContent>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="partner@example.com"
                      autoComplete="off"
                      readOnly={editMode}
                      {...field}
                    />
                  </FormControl>
                  {editMode ? (
                    <FormDescription>
                      Email address is immutable. Delete and re-add to change
                      it.
                    </FormDescription>
                  ) : (
                    <FormDescription>
                      By adding this email, you confirm this contact has
                      consented to receive status updates. We'll not be sending
                      a confirmation email.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
        ) : (
          <>
            <FormCardContent>
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://hooks.slack.com/services/…"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Only Slack and Discord webhook URLs are supported for now
                      - more channels to come.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormCardContent>
            <FormCardSeparator />
            <FormCardContent>
              <FormItem>
                <FormLabel>Request Headers</FormLabel>
                <FormDescription>
                  Custom headers to include in every webhook request.
                </FormDescription>
                {fields.map((f, idx) => (
                  <div key={f.id} className="grid gap-2 sm:grid-cols-5">
                    <FormField
                      control={form.control}
                      name={`headers.${idx}.key`}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <Input placeholder="Key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`headers.${idx}.value`}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <Input placeholder="Value" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      aria-label="Remove header"
                      onClick={() => remove(idx)}
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
                    onClick={() => append({ key: "", value: "" })}
                  >
                    <Plus />
                    Add Header
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            </FormCardContent>
          </>
        )}
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="componentIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Page Components</FormLabel>
                <FormDescription>
                  Leave empty to notify for the entire page. Select components
                  to only notify on matching reports.
                </FormDescription>
                {items.length ? (
                  <FormControl>
                    <CheckboxTree
                      items={items}
                      value={field.value ?? []}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                ) : (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No page components found</EmptyStateTitle>
                  </EmptyStateContainer>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
