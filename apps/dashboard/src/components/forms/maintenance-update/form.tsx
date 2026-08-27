"use client";

import { Calendar as CalendarIcon, Clock } from "@openstatus/icons";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { useIsMobile } from "@openstatus/ui/hooks/use-mobile";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { format } from "date-fns";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ProcessMessage } from "@/components/content/process-message";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { useTRPC } from "@/lib/trpc/client";

export type FormValues = {
  message: string;
  date: Date;
  notifySubscribers?: boolean;
};

export function FormMaintenanceUpdate({
  defaultValues,
  onSubmit,
  showNotifySubscribers = false,
  className,
  id,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  showNotifySubscribers?: boolean;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const mobile = useIsMobile();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm<FormValues>({
    defaultValues: {
      message: defaultValues?.message ?? "",
      date: defaultValues?.date ?? new Date(),
      notifySubscribers:
        defaultValues?.notifySubscribers ??
        !!workspace?.limits["status-subscribers"],
    },
  });
  const message = form.watch("message");
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();

  React.useEffect(() => {
    setIsDirty(form.formState.isDirty);
  }, [form.formState.isDirty, setIsDirty]);

  function submitAction(values: FormValues) {
    if (isPending) return;
    startTransition(async () => {
      const promise = onSubmit(values);
      toast.promise(promise, {
        loading: "Saving...",
        success: "Saved",
        error: (error) =>
          isTRPCClientError(error) ? error.message : "Failed to save",
      });
      try {
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  const timeInputId = `${id ?? "maintenance-update"}-time`;

  return (
    <Form {...form}>
      <form
        id={id}
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
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
                        className="w-full pl-3 text-left font-normal sm:w-[240px]"
                      >
                        {format(field.value, "PPP 'at' h:mm a")}
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
                      onSelect={(date) => {
                        if (!date) return;
                        date.setHours(
                          field.value.getHours(),
                          field.value.getMinutes(),
                          field.value.getSeconds(),
                          field.value.getMilliseconds(),
                        );
                        field.onChange(date);
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <div className="flex items-center gap-3">
                        <Label htmlFor={timeInputId} className="text-xs">
                          Enter time
                        </Label>
                        <div className="relative grow">
                          <Input
                            id={timeInputId}
                            type="time"
                            step="1"
                            defaultValue={field.value
                              .toTimeString()
                              .slice(0, 8)}
                            className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                            onChange={(event) => {
                              const [hours, minutes, seconds] =
                                event.target.value.split(":").map(Number);
                              if (hours === undefined || minutes === undefined)
                                return;
                              const date = new Date(field.value);
                              date.setHours(hours, minutes, seconds ?? 0, 0);
                              field.onChange(date);
                            }}
                          />
                          <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3">
                            <Clock size={16} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Shown in your timezone (
                  <code className="font-commit-mono text-foreground/70">
                    {timezone}
                  </code>
                  ) and saved as UTC.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">Writing</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea rows={6} required {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>Markdown support</FormDescription>
                  </FormItem>
                )}
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="grid gap-2">
                <Label>Preview</Label>
                <div className="prose prose-sm dark:prose-invert text-foreground rounded-md border px-3 py-2 text-sm">
                  <ProcessMessage value={message} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </FormCardContent>
        {showNotifySubscribers && workspace?.limits["status-subscribers"] ? (
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
                          id={`${id}-notify-subscribers`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <Label htmlFor={`${id}-notify-subscribers`}>
                          Send notification to subscribers
                        </Label>
                      </div>
                    </FormControl>
                    <FormMessage />
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
