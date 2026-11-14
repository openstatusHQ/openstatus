"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MonitorSlaCreditSchedule,
  sameCreditSchedule,
  slaCredit,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@openstatus/ui/components/ui/input-group";
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
import {
  formatSlaMonth,
  formatSlaTarget,
  nextSlaMonth,
  parseSlaPercent,
  SLA_PERCENT_MESSAGE,
} from "@/data/reportings.client";

const EXAMPLE_UPTIME = 99_120;

const percent = z.string().refine((v) => parseSlaPercent(v) !== null, {
  error: SLA_PERCENT_MESSAGE,
});

const schema = z.object({
  enabled: z.boolean(),
  stepPct: percent,
  creditPct: percent,
  capPct: percent,
});

type FormValues = z.infer<typeof schema>;

function toSchedule(values: {
  stepPct: string;
  creditPct: string;
  capPct: string;
}): MonitorSlaCreditSchedule | null {
  const stepPct = parseSlaPercent(values.stepPct);
  const creditPct = parseSlaPercent(values.creditPct);
  const capPct = parseSlaPercent(values.capPct);
  if (stepPct === null || creditPct === null || capPct === null) return null;
  return { stepPct, creditPct, capPct };
}

const fields = [
  { name: "creditPct", label: "Credit per step", unit: "% of fees" },
  { name: "stepPct", label: "Step below target", unit: "%" },
  { name: "capPct", label: "Cap", unit: "% of fees" },
] as const;

export function FormCredits({
  schedule: saved,
  slaTarget,
  live,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  schedule: MonitorSlaCreditSchedule | null;
  /** the latest target, in thousandths of a percent, for the example */
  slaTarget: number;
  /** the running month (YYYY-MM-01) and the schedule it started with */
  live: { month: string; creditSchedule: MonitorSlaCreditSchedule | null };
  onSubmit: (creditSchedule: MonitorSlaCreditSchedule | null) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: saved
      ? {
          enabled: true,
          stepPct: String(saved.stepPct),
          creditPct: String(saved.creditPct),
          capPct: String(saved.capPct),
        }
      : { enabled: false, stepPct: "0.25", creditPct: "3", capPct: "100" },
  });
  const [enabled, stepPct, creditPct, capPct] = useWatch({
    control: form.control,
    name: ["enabled", "stepPct", "creditPct", "capPct"],
  });
  const schedule = enabled ? toSchedule({ stepPct, creditPct, capPct }) : null;
  const example = slaCredit({
    up: EXAMPLE_UPTIME,
    total: 100_000,
    target: slaTarget,
    schedule,
  });
  const differsFromLive =
    (enabled ? schedule !== null : true) &&
    !sameCreditSchedule(schedule, live.creditSchedule);
  const [isPending, startTransition] = useTransition();

  function save(creditSchedule: MonitorSlaCreditSchedule | null) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(creditSchedule);
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

  function submitAction(values: FormValues) {
    save(values.enabled ? toSchedule(values) : null);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard id="service-credits">
          <FormCardHeader>
            <FormCardTitle>Service credits</FormCardTitle>
            <FormCardDescription>
              Optional. Each sealed month stores the credit it earned under the
              schedule, as a percentage of monthly fees.
            </FormCardDescription>
          </FormCardHeader>
          {enabled ? (
            <FormCardContent className="grid gap-4 sm:grid-cols-3">
              {fields.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            inputMode="decimal"
                            className="font-mono"
                            {...field}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>{f.unit}</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <p className="text-muted-foreground text-sm sm:col-span-3">
                {example === null ? (
                  "Enter all three to see an example."
                ) : (
                  <>
                    Example: a month at{" "}
                    <span className="text-foreground font-mono">
                      {formatSlaTarget(EXAMPLE_UPTIME)}%
                    </span>{" "}
                    {example.steps === 0 ? (
                      <>
                        meets {formatSlaTarget(slaTarget)}% and earns nothing.
                      </>
                    ) : (
                      <>
                        is{" "}
                        <span className="text-foreground font-mono">
                          {example.steps}
                        </span>{" "}
                        {example.steps === 1 ? "step" : "steps"} below{" "}
                        {formatSlaTarget(slaTarget)}%, a credit of{" "}
                        <span className="text-foreground font-mono">
                          {example.pct}%
                        </span>
                        . A started step counts as a full one.
                      </>
                    )}
                  </>
                )}
              </p>
            </FormCardContent>
          ) : (
            <FormCardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                No credit schedule. Months show no credit.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("enabled", true, { shouldDirty: true })
                }
              >
                Add a credit schedule
              </Button>
            </FormCardContent>
          )}
          <FormCardFooter>
            <FormCardFooterInfo role="status">
              {differsFromLive && form.formState.isDirty ? (
                <>
                  Applies from{" "}
                  <span className="text-foreground font-medium">
                    {formatSlaMonth(nextSlaMonth(live.month), { year: true })}
                  </span>
                  , with the other terms. A computed figure, not a billing
                  action.
                </>
              ) : (
                "A computed figure for your records, not a billing action. Claims and payouts are not tracked."
              )}
            </FormCardFooterInfo>
            <div className="flex gap-2">
              {enabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    form.reset({ ...form.getValues(), enabled: false });
                    if (saved) save(null);
                  }}
                >
                  Remove
                </Button>
              ) : null}
              <Button type="submit" disabled={isPending || !enabled}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
