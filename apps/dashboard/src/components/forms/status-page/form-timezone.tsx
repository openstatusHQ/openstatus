"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { isTRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { TimeZoneCombobox } from "@/components/common/time-zone-combobox";
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

const schema = z.object({
  defaultTimezone: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function FormTimezone({
  defaultValues,
  onSubmit,
  locked,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  locked?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { defaultTimezone: "UTC" },
  });

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
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard id="timezone">
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Time zone</FormCardTitle>
            <FormCardDescription>
              The time zone your status page shows its timestamps and daily bars
              in. Every visitor sees the same time.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="defaultTimezone"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Time zone</FormLabel>
                  <FormControl>
                    <TimeZoneCombobox
                      value={field.value}
                      onChange={field.onChange}
                      disabled={locked}
                      className="sm:max-w-md"
                    />
                  </FormControl>
                  <FormDescription>
                    Days on the status bars start at midnight in this zone.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>Defaults to UTC.</FormCardFooterInfo>
            {locked ? (
              <Button
                data-track="paywall_viewed"
                data-limit="timezone"
                type="button"
                asChild
              >
                <Link href="/settings/billing#plans">
                  <Lock className="size-4" />
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
