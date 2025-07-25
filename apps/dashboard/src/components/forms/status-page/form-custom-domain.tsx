"use client";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";

import { Label } from "@/components/ui/label";

import { InputWithAddons } from "@/components/common/input-with-addons";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link } from "@/components/common/link";
import DomainConfiguration from "@/components/domains/domain-configuration";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { isTRPCClientError } from "@trpc/client";
import type React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

const schema = z.object({
  domain: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function FormCustomDomain({
  locked,
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  locked?: boolean;
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
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
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          {locked ? <FormCardUpgrade /> : null}
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
                    disabled={locked}
                    {...field}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          {defaultValues?.domain ? (
            <>
              <FormCardSeparator />
              <FormCardContent>
                <DomainConfiguration domain={defaultValues?.domain} />
              </FormCardContent>
            </>
          ) : null}
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/status-page/advanced/custom-domain/"
                rel="noreferrer"
                target="_blank"
              >
                Custom Domain
              </Link>
              .
            </FormCardFooterInfo>
            {locked ? (
              <Button type="button" asChild>
                <Link href="/settings/billing">
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
