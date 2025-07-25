"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { config } from "@/data/notifications.client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  provider: z.literal("ntfy"),
  data: z.record(z.string(), z.string()),
  monitors: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormNtfy({
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
      provider: "ntfy",
      data: {
        topic: "",
        serverUrl: "",
        token: "",
      },
      monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();

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
        const data = form.getValues("data");
        const promise = config[provider].sendTest(
          data as unknown as {
            topic: string;
            serverUrl?: string;
            token?: string;
          },
        );
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
            name="data.topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input placeholder="your-topic" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Enter the topic for your ntfy notifications.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.serverUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://ntfy.sh" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Enter the ntfy server URL. Leave empty for default.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="data.token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bearer Token</FormLabel>
                <FormControl>
                  <Input placeholder="tk_iloveopenstatus" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Enter the bearer token for authentication.
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
