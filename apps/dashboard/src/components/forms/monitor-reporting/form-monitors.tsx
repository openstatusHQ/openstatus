"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";

import { type MonitorOption, SlaMonitorsField } from "./fields";

const schema = z.object({
  monitorIds: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormMonitors({
  defaultValues,
  monitors,
  strict,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues: FormValues;
  monitors: MonitorOption[];
  strict: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();
  const selected = useWatch({ control: form.control, name: "monitorIds" });

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) =>
            isTRPCClientError(error) ? error.message : "Failed to save",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard id="monitors">
          <FormCardHeader>
            <FormCardTitle>Monitors</FormCardTitle>
            <FormCardDescription>
              Each one is judged on its own. A monitor can be under several
              policies.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="monitorIds"
              render={({ field }) => (
                <FormItem>
                  <SlaMonitorsField
                    monitors={monitors}
                    value={field.value}
                    onChange={field.onChange}
                    strict={strict}
                    className="sm:grid-cols-2"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              <span className="text-foreground font-mono">
                {selected.length}
              </span>{" "}
              selected. An added monitor&apos;s earlier months show as previews.
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
