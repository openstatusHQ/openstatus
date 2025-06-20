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

import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isTRPCClientError } from "@trpc/client";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string(),
  provider: z.literal("email"),
  data: z.string().email(),
  monitors: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormEmail({
  monitors,
  defaultValues,
  onSubmit,
  className,
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
      provider: "email",
      data: "",
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

  return (
    <Form {...form}>
      <form
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
          name="data"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="max@openstatus.dev"
                  type="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Enter the email address to send notifications to.
              </FormDescription>
            </FormItem>
          )}
        />
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
        />
      </form>
    </Form>
  );
}
