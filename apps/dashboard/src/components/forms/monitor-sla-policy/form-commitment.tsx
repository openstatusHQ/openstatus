"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { parseSlaTarget } from "@/data/sla-policies.client";

import { SlaStrictField, SlaTargetField, slaTargetSchemaError } from "./fields";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  target: z.string().refine((v) => parseSlaTarget(v) !== null, {
    error: slaTargetSchemaError,
  }),
  strict: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function FormCommitment({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
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
        <FormCard id="commitment">
          <FormCardHeader>
            <FormCardTitle>Commitment</FormCardTitle>
            <FormCardDescription>
              The monthly uptime each monitor in this policy has to reach.
              Changes apply from the next unsealed month; sealed months keep the
              terms they were judged with.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enterprise contract" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <SlaTargetField value={field.value} onChange={field.onChange} />
              )}
            />
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="strict"
              render={({ field }) => (
                <SlaStrictField value={field.value} onChange={field.onChange} />
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Uptime counts each scheduled check once across its regions.
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
