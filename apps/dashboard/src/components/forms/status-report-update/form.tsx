"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { pageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
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
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { TabsContent } from "@openstatus/ui/components/ui/tabs";
import { TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { Tabs } from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import { ProcessMessage } from "@/components/content/process-message";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { ComponentImpactList } from "@/components/forms/status-report/component-impact-field";
import { colors } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

const schema = z.object({
  status: z.enum(statusReportStatus),
  message: z.string(),
  date: z.date(),
  componentImpacts: z
    .array(
      z.object({
        pageComponentId: z.number(),
        impact: z.enum(pageComponentImpact),
      }),
    )
    .optional(),
  notifySubscribers: z.boolean().optional(),
});

export type FormValues = z.infer<typeof schema>;

export function FormStatusReportUpdate({
  defaultValues,
  onSubmit,
  className,
  components,
  allowUnsetImpacts = false,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  /** The report's affected components; renders the per-component impact picker. */
  components?: { id: number; name: string }[];
  /** Edit mode: components without an entry show "No change". */
  allowUnsetImpacts?: boolean;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: defaultValues?.status ?? "identified",
      message: defaultValues?.message ?? "",
      date: defaultValues?.date ?? new Date(),
      componentImpacts: defaultValues?.componentImpacts,
      notifySubscribers:
        defaultValues?.notifySubscribers ??
        !!workspace?.limits["status-subscribers"],
    },
  });

  const watchMessage = form.watch("message");
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
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormCardContent>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Select
                    defaultValue={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // resolved implies components are back up — prefill, still editable
                      if (value === "resolved" && components?.length) {
                        form.setValue(
                          "componentImpacts",
                          components.map((c) => ({
                            pageComponentId: c.id,
                            impact: "operational" as const,
                          })),
                          { shouldDirty: true },
                        );
                      }
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        colors[field.value],
                        "font-mono capitalize",
                      )}
                    >
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusReportStatus.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          className={cn(colors[status], "font-mono capitalize")}
                        >
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    min={new Date("1900-01-01")}
                    max={new Date()}
                    className="w-[240px]"
                  />
                </FormControl>
                <FormDescription>
                  When the status report was created. Shown in your timezone (
                  <code className="font-commit-mono text-foreground/70">
                    {timezone}
                  </code>
                  ) and saved as Unix time (
                  <code className="font-commit-mono text-foreground/70">
                    UTC
                  </code>
                  ).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        {components && components.length > 0 ? (
          <>
            <FormCardSeparator />
            <FormCardContent>
              <FormField
                control={form.control}
                name="componentImpacts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Component Impact</FormLabel>
                    <FormDescription>
                      How badly is each affected component impacted?
                    </FormDescription>
                    <FormControl>
                      <ComponentImpactList
                        components={components}
                        value={field.value ?? []}
                        onValueChange={field.onChange}
                        allowUnset={allowUnsetImpacts}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormCardContent>
          </>
        ) : null}
        <FormCardSeparator />
        <FormCardContent>
          <Tabs defaultValue="tab-1">
            <TabsList>
              <TabsTrigger value="tab-1">Writing</TabsTrigger>
              <TabsTrigger value="tab-2">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="tab-1">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>Markdown support</FormDescription>
                  </FormItem>
                )}
              />
            </TabsContent>
            <TabsContent value="tab-2">
              <div className="grid gap-2">
                <Label>Preview</Label>
                <div className="prose prose-sm dark:prose-invert text-foreground rounded-md border px-3 py-2 text-sm">
                  <ProcessMessage value={watchMessage} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </FormCardContent>
        {!defaultValues?.date && workspace?.limits["status-subscribers"] ? (
          <>
            <FormCardSeparator />
            <FormCardContent>
              <FormField
                control={form.control}
                name="notifySubscribers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notify Subscribers</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="notifySubscribers"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Label htmlFor="notifySubscribers">
                          Send notification to subscribers
                        </Label>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Subscribers will be notified when creating a status
                      report.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </FormCardContent>
          </>
        ) : null}
      </form>
    </Form>
  );
}
