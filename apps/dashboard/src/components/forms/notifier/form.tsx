"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  provider: z.enum([
    "slack",
    "discord",
    "email",
    "sms",
    "webhook",
    "opsgenie",
    "pagerduty",
    "ntfy",
  ]),
  data: z.record(z.string(), z.string()),
  // monitors: z.array(z.number()),
});

export type FormValues = z.infer<typeof schema>;

export function NotifierForm({
  defaultValues,
  className,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit?: (values: FormValues) => Promise<void> | void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      data: {
        webhook: "",
      },
      // monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
        });
        await promise;
        onSubmit?.(values);
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        id="notifier-form"
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
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
          name="data.webhook"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Webhook URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/webhook" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <FormField
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
                          checked ? monitors.map((m) => m.id) : []
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
        /> */}
      </form>
    </Form>
  );
}
