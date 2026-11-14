"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@openstatus/ui/components/ui/form";
import { Switch } from "@openstatus/ui/components/ui/switch";
import { isTRPCClientError } from "@trpc/client";
import NextLink from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";

type FormValues = { linked: boolean };

export function FormSupportTerms({
  incidentPolicy,
  linked,
  holder,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  /** the workspace's incident policy, or null when there is none */
  incidentPolicy: { id: number; creditPerMissPct: number | null } | null;
  linked: boolean;
  /** another reporting holding the link */
  holder: { id: number; name: string } | null;
  onSubmit: (incidentSlaPolicyId: number | null) => Promise<void>;
}) {
  const form = useForm<FormValues>({ defaultValues: { linked } });
  const [isPending, startTransition] = useTransition();
  const takenElsewhere = !linked && holder !== null;

  function submitAction(values: FormValues) {
    if (isPending || !incidentPolicy) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values.linked ? incidentPolicy.id : null);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) =>
            isTRPCClientError(error) ? error.message : "Failed to save",
        });
        await promise;
        form.reset(values);
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard id="support-terms">
          <FormCardHeader>
            <FormCardTitle>Support terms</FormCardTitle>
            <FormCardDescription>
              Optional. Link the workspace&apos;s incident policy to add its
              support credits to this reporting&apos;s service credits.
            </FormCardDescription>
          </FormCardHeader>
          {incidentPolicy ? (
            <FormCardContent>
              <FormField
                control={form.control}
                name="linked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <FormLabel>Use the incident policy</FormLabel>
                      <FormDescription>
                        {takenElsewhere ? (
                          <>
                            Linked to{" "}
                            <Link
                              href={`/reportings/monitors/${holder.id}/edit`}
                            >
                              {holder.name}
                            </Link>
                            . One reporting holds it at a time: unlink it there
                            first.
                          </>
                        ) : incidentPolicy.creditPerMissPct === null ? (
                          "The incident policy has no support credit per miss yet, so it adds nothing."
                        ) : (
                          <>
                            <span className="text-foreground font-mono">
                              {incidentPolicy.creditPerMissPct}%
                            </span>{" "}
                            of monthly fees per missed response, resolution or
                            update target.
                          </>
                        )}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={takenElsewhere}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </FormCardContent>
          ) : (
            <FormCardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                No incident policy in this workspace.
              </p>
              <Button type="button" variant="outline" size="sm" asChild>
                <NextLink href="/reportings/incidents">
                  Set up incident policy
                </NextLink>
              </Button>
            </FormCardContent>
          )}
          <FormCardFooter>
            <FormCardFooterInfo>
              Support credits cover incidents declared in openstatus, not
              support requests tracked elsewhere.
            </FormCardFooterInfo>
            <Button
              type="submit"
              disabled={isPending || !incidentPolicy || takenElsewhere}
            >
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
