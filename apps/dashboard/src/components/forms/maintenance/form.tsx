"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { Label } from "@openstatus/ui/components/ui/label";
import { TabsContent } from "@openstatus/ui/components/ui/tabs";
import { TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { Tabs } from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { addDays } from "date-fns";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { ProcessMessage } from "@/components/content/process-message";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import {
  CheckboxTree,
  type CheckboxTreeItem,
} from "@/components/ui/checkbox-tree";
import { useTRPC } from "@/lib/trpc/client";

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    /** Create only: becomes the first timeline update. */
    message: z.string().trim().min(1, "Message is required").optional(),
    startDate: z.date(),
    endDate: z.date(),
    pageComponents: z.array(z.number()),
    notifySubscribers: z.boolean().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    error: "End date cannot be earlier than start date.",
    path: ["endDate"],
  });

export type FormValues = z.infer<typeof schema>;

export function FormMaintenance({
  defaultValues,
  onSubmit,
  className,
  items,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  items: CheckboxTreeItem[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      message: "",
      startDate: new Date(),
      endDate: addDays(new Date(), 1),
      pageComponents: [],
      notifySubscribers: !!workspace?.limits["status-subscribers"],
    },
  });

  const watchEndDate = form.watch("endDate");
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
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="DB migration..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          {/* TODO: */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    className="w-[240px]"
                    onChange={(date) => {
                      // a start moved past the end drags the end along,
                      // keeping the duration
                      if (watchEndDate && date > watchEndDate) {
                        const duration =
                          watchEndDate.getTime() - field.value.getTime();
                        form.setValue(
                          "endDate",
                          new Date(date.getTime() + duration),
                        );
                      }
                      field.onChange(date);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  When the maintenance starts. Shown in your timezone (
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
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    className="w-[240px]"
                  />
                </FormControl>
                <FormDescription>
                  When the maintenance ends. Shown in your timezone (
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
        {!defaultValues ? (
          <>
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
                        <FormDescription>
                          Markdown support. Posted as the first update; later
                          updates are added on the maintenance page.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value="tab-2">
                  <div className="grid gap-2">
                    <Label>Preview</Label>
                    <div className="prose dark:prose-invert prose-sm text-foreground rounded-md border px-3 py-2 text-sm">
                      <ProcessMessage value={watchMessage ?? ""} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </FormCardContent>
          </>
        ) : null}
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="pageComponents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Page Components</FormLabel>
                <FormDescription>
                  Connected page components will be affected for the period of
                  time.
                </FormDescription>
                {items.length ? (
                  <FormControl>
                    <CheckboxTree
                      items={items}
                      value={field.value ?? []}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                ) : (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No page components found</EmptyStateTitle>
                  </EmptyStateContainer>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        {!defaultValues && workspace?.limits["status-subscribers"] ? (
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
                      Subscribers will be notified when creating a maintenance.
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
