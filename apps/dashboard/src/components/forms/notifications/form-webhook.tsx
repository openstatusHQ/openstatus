"use client";

import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";

import { Link } from "@/components/common/link";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import { Form } from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Plus, X } from "lucide-react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  provider: z.literal("webhook"),
  data: z.object({
    endpoint: z.string().url(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  monitors: z.array(z.number()),
});

type FormValues = z.input<typeof schema>;

export function FormWebhook({
  defaultValues,
  onSubmit,
  className,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  monitors: { id: number; name: string }[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      provider: "webhook",
      data: {
        endpoint: "",
        headers: [],
      },
      monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();
  const trpc = useTRPC();

  const sendTestMutation = useMutation(
    trpc.notification.sendTest.mutationOptions(),
  );

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
          success: "Saved",
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

  function testAction() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const provider = form.getValues("provider");
        const endpoint = form.getValues("data.endpoint");
        const headers = form.getValues("data.headers");
        const promise = sendTestMutation.mutateAsync({
          provider,
          data: {
            webhook: { endpoint, headers },
          },
        });
        toast.promise(promise, {
          loading: "Sending test...",
          success: "Test sent",
          error: (error) => {
            if (error instanceof Error) {
              return error.message;
            }
            return "Failed to send test";
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
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Notifier" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Enter a descriptive name for your notifier.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.endpoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Webhook URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com/webhook" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Send notifications to a custom webhook URL.{" "}
                  <Link
                    href="https://docs.openstatus.dev/reference/notification/#webhook"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Read more
                  </Link>
                  .
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.headers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Request Headers</FormLabel>
                {field.value?.map((header, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-5">
                    <Input
                      placeholder="Key"
                      className="col-span-2"
                      value={header.key}
                      onChange={(e) => {
                        const newHeaders = [...field.value];
                        newHeaders[index] = {
                          ...newHeaders[index],
                          key: e.target.value,
                        };
                        field.onChange(newHeaders);
                      }}
                    />
                    <Input
                      placeholder="Value"
                      className="col-span-2"
                      value={header.value}
                      onChange={(e) => {
                        const newHeaders = [...field.value];
                        newHeaders[index] = {
                          ...newHeaders[index],
                          value: e.target.value,
                        };
                        field.onChange(newHeaders);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        const newHeaders = field.value.filter(
                          (_, i) => i !== index,
                        );
                        field.onChange(newHeaders);
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
                    onClick={() => {
                      field.onChange([
                        ...(field.value ?? []),
                        { key: "", value: "" },
                      ]);
                    }}
                  >
                    <Plus />
                    Add Header
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={testAction}
            >
              Send Test
            </Button>
          </div>
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
                  Select the monitors you want to notify.
                </FormDescription>
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        id="all"
                        checked={field.value?.length === monitors.length}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked ? monitors.map((m) => m.id) : [],
                          );
                        }}
                      />
                    </FormControl>
                    <Label htmlFor="all">Select all</Label>
                  </div>
                  {monitors.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          id={String(item.id)}
                          checked={field.value?.includes(item.id)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...(field.value || []), item.id]
                              : field.value?.filter((id) => id !== item.id);
                            field.onChange(newValue);
                          }}
                        />
                      </FormControl>
                      <Label htmlFor={String(item.id)}>{item.name}</Label>
                    </div>
                  ))}
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
