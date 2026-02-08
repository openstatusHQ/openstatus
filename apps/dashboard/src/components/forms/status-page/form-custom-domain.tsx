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

import { Label } from "@openstatus/ui/components/ui/label";

// FIXME: use input-group instead
import { InputWithAddons } from "@/components/common/input-with-addons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link } from "@/components/common/link";
import DomainConfiguration from "@/components/domains/domain-configuration";
import { useDomainStatus } from "@/components/domains/use-domain-status";
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { isTRPCClientError } from "@trpc/client";
import type React from "react";
import { useEffect, useTransition } from "react";
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
  const { refresh, isLoading } = useDomainStatus(defaultValues?.domain);

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

  // NOTE: poll every 30 seconds to check for the status
  useEffect(() => {
    const interval = setInterval(() => refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

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
                href="https://docs.openstatus.dev/reference/status-page/#custom-domain"
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending || isLoading}
                  onClick={refresh}
                  className="hidden sm:block"
                >
                  {isLoading ? "Refreshing..." : "Refresh Configuration"}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            )}
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
