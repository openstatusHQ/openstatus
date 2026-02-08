"use client";

import { ProcessMessage } from "@/components/content/process-message";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { colors } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { statusReportStatus } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/components/ui/button";
import { Calendar } from "@openstatus/ui/components/ui/calendar";
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
import {
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Popover } from "@openstatus/ui/components/ui/popover";
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
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  status: z.enum(statusReportStatus),
  message: z.string(),
  date: z.date(),
  notifySubscribers: z.boolean().optional(),
});

export type FormValues = z.infer<typeof schema>;

export function FormStatusReportUpdate({
  defaultValues,
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(
    trpc.workspace.getWorkspace.queryOptions(),
  );
  const mobile = useIsMobile();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: defaultValues?.status ?? "identified",
      message: defaultValues?.message ?? "",
      date: defaultValues?.date ?? new Date(),
      notifySubscribers: defaultValues?.notifySubscribers ?? true,
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
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
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
                <Popover modal>
                  <FormControl>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[240px] pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP 'at' h:mm a")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </FormControl>
                  <PopoverContent
                    className="pointer-events-auto w-auto p-0"
                    align="start"
                    side={mobile ? "bottom" : "left"}
                  >
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(selectedDate) => {
                        if (!selectedDate) return;
                        const newDate = new Date(selectedDate);
                        newDate.setHours(
                          field.value.getHours(),
                          field.value.getMinutes(),
                          field.value.getSeconds(),
                          field.value.getMilliseconds(),
                        );
                        field.onChange(newDate);
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="time" className="text-xs">
                          Enter time
                        </Label>
                        <div className="relative grow">
                          <Input
                            id="time"
                            type="time"
                            step="1"
                            defaultValue={new Date().toTimeString().slice(0, 8)}
                            className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                            onChange={(e) => {
                              try {
                                const timeValue = e.target.value;
                                if (!timeValue || !field.value) return;

                                const [hours, minutes, seconds] = timeValue
                                  .split(":")
                                  .map(Number);

                                const newDate = new Date(field.value);
                                newDate.setHours(
                                  hours,
                                  minutes,
                                  seconds || 0,
                                  0,
                                );

                                field.onChange(newDate);
                              } catch (error) {
                                console.error(error);
                              }
                            }}
                          />
                          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
                            <ClockIcon size={16} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
                <div className="prose prose-sm dark:prose-invert rounded-md border px-3 py-2 text-foreground text-sm">
                  <ProcessMessage value={watchMessage} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
                          Send email notification to subscribers
                        </Label>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Subscribers will receive an email when creating a status
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
