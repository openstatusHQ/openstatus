"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Form } from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { CheckboxTree } from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";

const pushoverKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9]{30}$/, "Must be exactly 30 alphanumeric characters");

const schema = z.object({
  name: z.string(),
  provider: z.literal("pushover"),
  data: z.object({
    token: pushoverKeySchema,
    user: pushoverKeySchema,
    priority: z.string(),
  }),
  monitors: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

const priorities = [
  { value: "-2", label: "Lowest" },
  { value: "-1", label: "Low" },
  { value: "0", label: "Normal" },
  { value: "1", label: "High" },
];

export function FormPushover({
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
      provider: "pushover",
      data: {
        token: "",
        user: "",
        priority: "0",
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
      const valid = await form.trigger(["data.token", "data.user"]);
      if (!valid) return;
      try {
        const provider = form.getValues("provider");
        const data = form.getValues("data");
        const promise = sendTestMutation.mutateAsync({
          provider,
          data: {
            pushover: data,
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
            name="data.token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Application API Token</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="azGDORePK8gMaC0QOYAMyEEuzJnyUi"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Your Pushover application API token.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.user"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User / Group Key</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="uQiRzpo4DXghDmr9QzzfQu27cmVRsG"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Your Pushover user or group key.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                <FormDescription>
                  Recovery notifications are always sent at normal priority.
                </FormDescription>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
