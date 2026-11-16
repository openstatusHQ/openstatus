"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@openstatus/api";
import {
  MONITOR_SLA_EXCUSED_REASON_MAX,
  MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
  type MonitorSlaExcusedWindowKind,
  monitorSlaExcusedWindowKinds,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  excusedKindLabels,
  excusedWindowContext,
  formatSlaDuration,
  formatSlaMonth,
  slaMonthOf,
} from "@/data/reportings.client";
import { formatDate, formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

type Policy = RouterOutputs["monitorReporting"]["get"];

export type ExcusedWindowPrefill = {
  from?: Date;
  to?: Date;
  kind?: MonitorSlaExcusedWindowKind;
  reason?: string;
  /** preselected; members of the policy only */
  monitorIds?: number[];
  /** provenance: the maintenance window it was prefilled from */
  monitorMaintenanceWindowId?: number;
  /** status-page announcements of the prefilled maintenance, as notice evidence */
  announcements?: { pageTitle: string | null; createdAt: Date | null }[];
};

function makeSchema(timeZone: string) {
  return z
    .object({
      from: z.date(),
      to: z.date(),
      kind: z.enum(monitorSlaExcusedWindowKinds),
      reason: z
        .string()
        .trim()
        .min(1, "A reason is required")
        .max(MONITOR_SLA_EXCUSED_REASON_MAX),
      monitorIds: z.array(z.number()).min(1, "Pick at least one monitor."),
    })
    .refine((v) => v.from < v.to, {
      message: "The window must end after it starts.",
      path: ["to"],
    })
    .refine(
      (v) =>
        v.to.getTime() - v.from.getTime() <= MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
      { message: "A window lasts at most 7 days.", path: ["to"] },
    )
    .refine(
      // the end is exclusive: a window ending at midnight on the 1st stays in its month
      (v) =>
        slaMonthOf(new Date(v.to.getTime() - 1), timeZone) <=
        slaMonthOf(new Date(), timeZone),
      {
        message: "A window cannot reach into a future month.",
        path: ["to"],
      },
    );
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

function defaultWindow(): { from: Date; to: Date } {
  const to = new Date();
  to.setSeconds(0, 0);
  return { from: new Date(to.getTime() - 3_600_000), to };
}

export function DialogExcusedWindow({
  policy,
  prefill,
  open,
  onOpenChange,
}: {
  policy: Policy;
  prefill: ExcusedWindowPrefill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Excuse a window</DialogTitle>
          <DialogDescription>
            Checks inside the window are left out of both sides of the month for
            the monitors you pick. Once its month is sealed, the window can no
            longer be removed.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ExcusedWindowForm
            policy={policy}
            prefill={prefill}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExcusedWindowForm({
  policy,
  prefill,
  onDone,
}: {
  policy: Policy;
  prefill: ExcusedWindowPrefill | null;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const addMutation = useMutation(
    trpc.monitorReporting.addExcusedWindow.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.monitorReporting.pathKey(),
        }),
    }),
  );
  const memberIds = new Set(policy.monitors.map((m) => m.id));
  const prefilled = prefill?.monitorIds?.filter((id) => memberIds.has(id));
  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(policy.timeZone)),
    defaultValues: {
      ...(prefill?.from && prefill.to
        ? { from: prefill.from, to: prefill.to }
        : defaultWindow()),
      kind: prefill?.kind ?? "maintenance",
      reason: prefill?.reason ?? "",
      monitorIds: prefilled?.length ? prefilled : [...memberIds],
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const context = excusedWindowContext(policy, kind);
  const [from, to] = useWatch({ control: form.control, name: ["from", "to"] });
  const validWindow =
    from instanceof Date &&
    to instanceof Date &&
    from < to &&
    to.getTime() - from.getTime() <= MONITOR_SLA_EXCUSED_WINDOW_MAX_MS;
  // no placeholder: the previous window's figures would describe the wrong range
  const { data: preview } = useQuery(
    trpc.monitorReporting.excusedWindowPreview.queryOptions(
      validWindow ? { policyId: policy.id, from, to } : skipToken,
    ),
  );
  const measuredOf = new Map(
    validWindow
      ? (preview?.monitors.map((m) => [m.id, m.measuredMs]) ?? [])
      : [],
  );
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function submitAction(values: FormValues) {
    if (isPending) return;
    startTransition(async () => {
      const promise = addMutation.mutateAsync({
        policyId: policy.id,
        ...values,
        monitorMaintenanceWindowId: prefill?.monitorMaintenanceWindowId,
      });
      toast.promise(promise, {
        loading: "Saving...",
        success: "Window excused",
        error: (error) =>
          isTRPCClientError(error) ? error.message : "Failed to save",
      });
      try {
        await promise;
        onDone();
      } catch (error) {
        console.error("Failed to excuse window:", error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(submitAction)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="text-muted-foreground -mt-2 text-sm">
          In your timezone ({timeZone}); the list shows windows in{" "}
          {policy.timeZone}. At most 7 days, in the current or the previous
          month, in {policy.timeZone}.
        </p>
        <FormField
          control={form.control}
          name="monitorIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monitors</FormLabel>
              <div className="grid gap-2">
                {policy.monitors.map((monitor) => {
                  const id = `excused-monitor-${monitor.id}`;
                  const measuredMs = measuredOf.get(monitor.id);
                  return (
                    <Label
                      key={monitor.id}
                      htmlFor={id}
                      className="hover:bg-muted/50 has-aria-checked:bg-muted/50 flex min-w-0 items-start gap-3 rounded-lg border p-3 font-normal"
                    >
                      <Checkbox
                        id={id}
                        checked={field.value.includes(monitor.id)}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next === true
                              ? [...field.value, monitor.id]
                              : field.value.filter((v) => v !== monitor.id),
                          )
                        }
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium">{monitor.name}</span>
                        {measuredMs === 0 ? (
                          <span className="text-warning text-xs">
                            No checks ran in this window; excusing it changes
                            nothing for this monitor.
                          </span>
                        ) : measuredMs ? (
                          <span className="text-muted-foreground text-xs">
                            {formatSlaDuration(measuredMs)} measured in this
                            window
                          </span>
                        ) : null}
                      </span>
                    </Label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kind</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {monitorSlaExcusedWindowKinds.map((k) => (
                    <SelectItem key={k} value={k}>
                      {excusedKindLabels[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                A label for the record; it changes nothing in the calculation.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Database upgrade, announced Oct 30"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
          {prefill?.announcements ? (
            <li>{noticeLine(prefill.announcements, prefill.from)}</li>
          ) : null}
          <li>
            {context.lastOfKind
              ? `The last excused window of kind ${excusedKindLabels[kind]} started ${formatDate(context.lastOfKind)}.`
              : `No excused window of kind ${excusedKindLabels[kind]} yet.`}
          </li>
          <li>
            {context.missed} of the last {context.months.length} complete months
            had a miss
            {context.months.length > 0
              ? ` (${context.months.map((m) => formatSlaMonth(m)).join(", ")})`
              : ""}
            .
          </li>
          <li>
            Contract rules about which windows qualify are not checked here.
          </li>
        </ul>
        <DialogFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Excuse window"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** How far ahead the maintenance was announced; informs, refuses nothing. */
function noticeLine(
  announcements: { pageTitle: string | null; createdAt: Date | null }[],
  startsAt: Date | undefined,
) {
  const dated = announcements.filter(
    (a): a is { pageTitle: string | null; createdAt: Date } =>
      a.createdAt !== null,
  );
  if (dated.length === 0) return "Not announced on a status page.";
  const first = dated.reduce((a, b) => (b.createdAt < a.createdAt ? b : a));
  const pages = [
    ...new Set(dated.map((a) => a.pageTitle ?? "a status page")),
  ].join(", ");
  const ahead = startsAt ? startsAt.getTime() - first.createdAt.getTime() : 0;
  return ahead > 0
    ? `Announced on ${pages}, ${formatDurationShort(ahead)} ahead.`
    : `Announced on ${pages} after it started.`;
}
