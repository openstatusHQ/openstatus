"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type IncidentSlaResolutionStop,
  type IncidentSlaResponseMet,
  type IncidentSlaTargets,
  incidentSlaTargetKinds,
  incidentSlaTargetsError,
} from "@openstatus/db/src/schema/incident_sla_policies/constants";
import { formatIncidentSlaMinutes } from "@openstatus/db/src/schema/incident_sla_policies/events";
import { incidentSeverity } from "@openstatus/db/src/schema/incidents/constants";
import { Lock } from "@openstatus/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { StatusDot } from "@/components/common/status-dot";
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
import { parseSlaDuration } from "@/data/incident-sla.client";
import { severityConfig } from "@/data/managed-incidents.client";

const COLUMNS = [
  { key: "responseMinutes", label: "First response" },
  { key: "resolutionMinutes", label: "Resolution" },
  { key: "updateMinutes", label: "Update every" },
] as const satisfies readonly {
  key: (typeof incidentSlaTargetKinds)[number];
  label: string;
}[];

const duration = z.string().refine((v) => parseSlaDuration(v).ok, {
  error: "Use a duration like 30m, 4h or 3d.",
});
const row = z.object({
  responseMinutes: duration,
  resolutionMinutes: duration,
  updateMinutes: duration,
});
const schema = z.object({
  targets: z.object({ critical: row, major: row, minor: row }),
  resolutionStop: z.enum(["mitigated", "resolved"]),
  responseMet: z.enum(["acknowledged", "status_report"]),
});

type FormValues = z.infer<typeof schema>;

export type IncidentReportingValues = {
  targets: IncidentSlaTargets;
  resolutionStop: IncidentSlaResolutionStop;
  responseMet: IncidentSlaResponseMet;
};

function toFormValues(policy: IncidentReportingValues): FormValues {
  const cell = (minutes: number | undefined) =>
    minutes === undefined ? "" : formatIncidentSlaMinutes(minutes);
  const cells = (severity: (typeof incidentSeverity)[number]) => {
    const t = policy.targets[severity] ?? {};
    return {
      responseMinutes: cell(t.responseMinutes),
      resolutionMinutes: cell(t.resolutionMinutes),
      updateMinutes: cell(t.updateMinutes),
    };
  };
  return {
    targets: {
      critical: cells("critical"),
      major: cells("major"),
      minor: cells("minor"),
    },
    resolutionStop: policy.resolutionStop,
    responseMet: policy.responseMet,
  };
}

function toTargets(values: FormValues): IncidentSlaTargets {
  const targets: IncidentSlaTargets = {};
  for (const severity of incidentSeverity) {
    for (const kind of incidentSlaTargetKinds) {
      const parsed = parseSlaDuration(values.targets[severity][kind]);
      if (parsed.ok && parsed.minutes !== undefined) {
        targets[severity] = { ...targets[severity], [kind]: parsed.minutes };
      }
    }
  }
  return targets;
}

export function FormIncidentReporting({
  defaultValues,
  saved,
  locked,
  readOnly,
  onSubmit,
  onDelete,
  onUpgrade,
}: {
  defaultValues: IncidentReportingValues;
  /** A reporting exists, so it can be turned off. */
  saved: boolean;
  locked: boolean;
  readOnly: boolean;
  onSubmit: (values: IncidentReportingValues) => Promise<void>;
  onDelete: () => Promise<void>;
  onUpgrade: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(defaultValues),
  });
  const [isPending, startTransition] = useTransition();
  const stop = useWatch({ control: form.control, name: "resolutionStop" });
  const responseMet = useWatch({ control: form.control, name: "responseMet" });
  const [turningOn, setTurningOn] = useState(false);
  // no saved policy: show the defaults muted until the user turns it on
  const off = !saved && !locked && !turningOn;
  const disabled = locked || readOnly || off;

  function run(
    promise: Promise<void>,
    copy: { loading: string; success: string },
  ) {
    toast.promise(promise, {
      ...copy,
      error: (error) =>
        isTRPCClientError(error) ? error.message : "Failed to save",
    });
    return promise;
  }

  function submitAction(values: FormValues) {
    if (isPending) return;
    const targets = toTargets(values);
    const error = incidentSlaTargetsError(targets);
    if (error) {
      form.setError("root", { message: error });
      return;
    }
    startTransition(async () => {
      try {
        await run(
          onSubmit({
            targets,
            resolutionStop: values.resolutionStop,
            responseMet: values.responseMet,
          }),
          {
            loading: "Saving...",
            success: "Saved",
          },
        );
        form.reset(values);
      } catch (error) {
        console.error(error);
      }
    });
  }

  function deleteAction() {
    startTransition(async () => {
      try {
        await run(onDelete(), {
          loading: "Turning off...",
          success: "Turned off",
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  const errors = form.formState.errors;
  const fieldError =
    errors.root?.message ??
    incidentSeverity
      .flatMap((s) => COLUMNS.map((c) => errors.targets?.[s]?.[c.key]?.message))
      .find(Boolean);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard id="targets">
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>
              Targets
              {/* always rendered: the mono span changes the line box height */}
              <span
                aria-hidden={!off}
                className={cn(
                  "text-muted-foreground ml-2 font-mono text-xs leading-none font-normal",
                  !off && "invisible",
                )}
              >
                off
              </span>
            </FormCardTitle>
            <FormCardDescription>
              How fast an incident gets its first response, updates and a
              resolution, per severity. Applies to incidents declared from now
              on.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className={cn(off && "opacity-50")}>
            <div
              role="table"
              aria-label="Targets per severity"
              className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-3 gap-y-2 sm:grid-cols-[8rem_repeat(3,minmax(0,10rem))]"
            >
              <div role="row" className="contents">
                <span
                  role="columnheader"
                  className="text-muted-foreground self-end text-sm leading-tight"
                >
                  Severity
                </span>
                {COLUMNS.map((column) => (
                  <span
                    key={column.key}
                    role="columnheader"
                    className="text-muted-foreground self-end text-sm leading-tight"
                  >
                    {column.label}
                  </span>
                ))}
              </div>
              {incidentSeverity.map((severity) => (
                <div key={severity} role="row" className="contents">
                  <span
                    role="rowheader"
                    className="flex items-center gap-2 font-mono text-sm"
                  >
                    <StatusDot
                      variant={severityConfig[severity].variant}
                      className="rounded-xs"
                    />
                    {severityConfig[severity].label}
                  </span>
                  {COLUMNS.map((column) => (
                    <FormField
                      key={column.key}
                      control={form.control}
                      name={`targets.${severity}.${column.key}`}
                      render={({ field, fieldState }) => (
                        <FormItem role="cell">
                          <FormControl>
                            <Input
                              {...field}
                              aria-label={`${severityConfig[severity].label}: ${column.label}`}
                              aria-invalid={fieldState.invalid || undefined}
                              placeholder="Off"
                              className="font-mono"
                              disabled={disabled}
                              onChange={(e) => {
                                form.clearErrors("root");
                                field.onChange(e);
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
            {fieldError ? (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {fieldError}
              </p>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                Durations as <span className="font-mono">30m</span>,{" "}
                <span className="font-mono">4h</span> or{" "}
                <span className="font-mono">3d</span>, from 5 minutes to 30
                days. An empty field turns that timer off for the severity.
              </p>
            )}
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent
            className={cn("grid gap-4 sm:grid-cols-3", off && "opacity-50")}
          >
            <FormField
              control={form.control}
              name="responseMet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Response is met by</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="acknowledged">
                        Acknowledgement
                      </SelectItem>
                      <SelectItem value="status_report">
                        First status report update
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <p className="text-muted-foreground self-end text-sm sm:col-span-2">
              {responseMet === "acknowledged"
                ? "Measures when the team noticed: the first acknowledgement, or any action a member takes on the incident."
                : "Measures when customers were told: the first update on the incident's status report. Acknowledging does not stop the clock."}
            </p>
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent
            className={cn("grid gap-4 sm:grid-cols-3", off && "opacity-50")}
          >
            <FormField
              control={form.control}
              name="resolutionStop"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution target stops at</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mitigated">Mitigated</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <p className="text-muted-foreground self-end text-sm sm:col-span-2">
              {stop === "mitigated"
                ? "The clock stops when customer impact ends. Cleanup after mitigation does not count against the target."
                : "The clock runs until the incident is marked resolved, including cleanup after mitigation."}
            </p>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              {readOnly && !locked
                ? "Only owners and admins can change the reporting."
                : off
                  ? "The reporting is off: incidents are declared without targets. Turn it on to review these defaults and save them."
                  : "A notice goes out at 75% of each target and again when it is missed: in Slack, or by email to the commander and declarer when Slack cannot deliver."}
            </FormCardFooterInfo>
            <div className="flex shrink-0 items-center gap-2">
              {saved && !readOnly ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                    >
                      Turn off
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Turn off the incident policy?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Incidents declared from now on carry no targets.
                        Incidents already declared keep theirs.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteAction}>
                        Turn off
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {locked ? (
                <Button
                  type="button"
                  size="sm"
                  data-track="paywall_viewed"
                  data-limit="incident-sla"
                  onClick={onUpgrade}
                >
                  <Lock />
                  Upgrade
                </Button>
              ) : readOnly ? null : off ? (
                <Button
                  type="button"
                  size="sm"
                  // the submit button renders in its place before the click's default action
                  onClick={(e) => {
                    e.preventDefault();
                    setTurningOn(true);
                  }}
                >
                  Turn on
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit"}
                </Button>
              )}
            </div>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
