"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { incidentSeverity } from "@openstatus/db/src/schema/incidents/constants";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { personName } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import { Link } from "@/components/common/link";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { severityConfig } from "@/data/managed-incidents.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

const NONE = "none";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(256),
  severity: z.enum(incidentSeverity),
  summary: z.string().max(4000),
  commanderId: z.string(),
  startedAt: z
    .date()
    .refine(
      (value) => value <= new Date(),
      "Start time cannot be in the future.",
    ),
  statusReportId: z.string(),
  openSlackChannel: z.boolean(),
});

export type FormValues = z.infer<typeof schema>;

export type DeclareIncidentValues = {
  title: string;
  severity: FormValues["severity"];
  summary?: string;
  commanderId: number | null;
  startedAt: Date;
  statusReportId?: number;
  openSlackChannel: boolean;
};

export function FormDeclareIncident({
  defaultValues,
  onSubmit,
  slack,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValues"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: DeclareIncidentValues) => Promise<void>;
  /** `ready`: connected, on the plan, fully scoped. */
  slack: "ready" | "reconnect" | "disconnected";
}) {
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const { data: reports } = useQuery(
    trpc.statusReport.list.queryOptions({ order: "desc" }),
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      severity: "major",
      summary: "",
      // user.get is prefetched in the dashboard layout, so it is hydrated
      // before the sheet can mount and the default is never NONE for members.
      commanderId: user ? String(user.id) : NONE,
      startedAt: new Date(),
      statusReportId: NONE,
      openSlackChannel: slack === "ready",
      ...defaultValues,
    },
  });
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  function submitAction(values: FormValues) {
    if (isPending) return;
    startTransition(async () => {
      try {
        const promise = onSubmit({
          title: values.title,
          severity: values.severity,
          summary: values.summary || undefined,
          commanderId:
            values.commanderId === NONE ? null : Number(values.commanderId),
          startedAt: values.startedAt,
          statusReportId:
            values.statusReportId === NONE
              ? undefined
              : Number(values.statusReportId),
          openSlackChannel: slack === "ready" && values.openSlackChannel,
        });
        toast.promise(promise, {
          loading: "Declaring...",
          success: () => "Incident declared",
          error: (error) => errorMessage(error, "Failed to declare"),
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Checkout is failing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger size="sm" className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {incidentSeverity.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {severityConfig[severity].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Critical: major outage or data loss. Major: significant
                  degradation. Minor: limited impact.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Summary</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="commanderId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commander</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>No commander</SelectItem>
                    {(members ?? []).map((member) => (
                      <SelectItem
                        key={member.user.id}
                        value={String(member.user.id)}
                      >
                        {personName(member.user) ?? `User ${member.user.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Started at</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    max={new Date()}
                    className="w-[240px]"
                  />
                </FormControl>
                <FormDescription>
                  When the impact began. Set it in the past to record an
                  incident after the fact.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="statusReportId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status report</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(reports ?? [])
                      .filter((report) => report.status !== "resolved")
                      .map((report) => (
                        <SelectItem key={report.id} value={String(report.id)}>
                          {report.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Link an open status report. You can also create one from the
                  incident later.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent className="grid gap-4">
          {slack === "ready" ? (
            <FormField
              control={form.control}
              name="openSlackChannel"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Open a Slack channel and try to add you to it
                  </FormLabel>
                </FormItem>
              )}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {slack === "reconnect"
                ? "Reconnect Slack in "
                : "Connect Slack in "}
              <Link href="/settings/integrations">Settings → Integrations</Link>{" "}
              to open a channel for each incident.
            </p>
          )}
        </FormCardContent>
      </form>
    </Form>
  );
}
