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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  excusedKindLabels,
  excusedWindowContext,
  formatSlaMonth,
} from "@/data/sla-policies.client";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

type Policy = RouterOutputs["monitorSlaPolicy"]["get"];

export type ExcusedWindowPrefill = {
  from: Date;
  to: Date;
  kind?: MonitorSlaExcusedWindowKind;
  reason?: string;
  /** monitors of the maintenance whose checks pause: excusing changes nothing for them */
  pausedMonitors?: string[];
};

const schema = z
  .object({
    from: z.date(),
    to: z.date(),
    kind: z.enum(monitorSlaExcusedWindowKinds),
    reason: z
      .string()
      .trim()
      .min(1, "A reason is required")
      .max(MONITOR_SLA_EXCUSED_REASON_MAX),
  })
  .refine((v) => v.from < v.to, {
    message: "The window must end after it starts.",
    path: ["to"],
  })
  .refine(
    (v) =>
      v.to.getTime() - v.from.getTime() <= MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
    { message: "A window lasts at most 7 days.", path: ["to"] },
  );

type FormValues = z.infer<typeof schema>;

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
            Checks inside the window are left out of both sides of the month,
            for every monitor in {policy.name}. Once its month is sealed, the
            window can no longer be removed.
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
    trpc.monitorSlaPolicy.addExcusedWindow.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.monitorSlaPolicy.get.queryKey(),
        }),
    }),
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(prefill ?? defaultWindow()),
      kind: prefill?.kind ?? "maintenance",
      reason: prefill?.reason ?? "",
    },
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const context = excusedWindowContext(policy, kind);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function submitAction(values: FormValues) {
    if (isPending) return;
    startTransition(async () => {
      const promise = addMutation.mutateAsync({
        policyId: policy.id,
        ...values,
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
          In your timezone ({timeZone}); the list shows windows in UTC. At most
          7 days, in the current or the previous month.
        </p>
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
          <li>
            {context.lastOfKind
              ? `The last ${excusedKindLabels[kind].toLowerCase()} window started ${formatDate(context.lastOfKind)}.`
              : `No ${excusedKindLabels[kind].toLowerCase()} window yet.`}
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
        {prefill?.pausedMonitors?.length ? (
          <p className="text-warning text-sm">
            Checks pause during maintenance for{" "}
            {prefill.pausedMonitors.join(", ")}: that time is not counted
            anyway, so excusing it changes nothing for{" "}
            {prefill.pausedMonitors.length === 1 ? "it" : "them"}.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Excuse window"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
