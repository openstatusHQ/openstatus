"use client";

import {
  FormCard,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardDescription,
  FormCardContent,
  FormCardUpgrade,
} from "@/components/forms/form-card";

import { Label } from "@/components/ui/label";

import { InputWithAddons } from "@/components/common/input-with-addons";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Link } from "@/components/common/link";

const LOCKED = true;

const schema = z.object({
  domain: z.string().min(1, "Domain is required"),
});

type FormValues = z.infer<typeof schema>;

export function FormCustomDomain({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit?: (values: FormValues) => Promise<void> | void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      domain: undefined,
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        onSubmit?.(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
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
        <FormCard>
          {LOCKED ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Custom Domain</FormCardTitle>
            <FormCardDescription>
              Use your own domain for your status page.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <Label>Domain</Label>
                  <InputWithAddons
                    placeholder="status.openstatus.dev"
                    leading="https://"
                    disabled={LOCKED}
                    {...field}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about <Link href="#">Custom Domain</Link>.
            </FormCardFooterInfo>
            {LOCKED ? (
              <Button type="button" asChild>
                <Link href="/dashboard/settings/billing">
                  <Lock />
                  Upgrade
                </Link>
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            )}
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
