"use client";

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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TabsContent } from "@/components/ui/tabs";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { addDays, format } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z
  .object({
    title: z.string().min(1, "Title is required"),
    message: z.string(),
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
  pageComponents,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  pageComponents: { id: number; name: string }[];
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
    defaultValues: defaultValues ?? {
      title: "",
      message: "",
      startDate: new Date(),
      endDate: addDays(new Date(), 1),
      pageComponents: [],
      notifySubscribers: true,
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

                        // NOTE: if end date is before start date, set it to the same day as the start date
                        if (watchEndDate && newDate > watchEndDate) {
                          form.setValue("endDate", newDate);
                        }
                      }}
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="time-start" className="text-xs">
                          Enter time
                        </Label>
                        <div className="relative grow">
                          <Input
                            id="time-start"
                            type="time"
                            step="1"
                            value={
                              field.value
                                ? field.value.toTimeString().slice(0, 8)
                                : new Date().toTimeString().slice(0, 8)
                            }
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
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="time-end" className="text-xs">
                          Enter time
                        </Label>
                        <div className="relative grow">
                          <Input
                            id="time-end"
                            type="time"
                            step="1"
                            value={
                              field.value
                                ? field.value.toTimeString().slice(0, 8)
                                : new Date().toTimeString().slice(0, 8)
                            }
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
                <div className="prose dark:prose-invert prose-sm rounded-md border px-3 py-2 text-foreground text-sm">
                  <ProcessMessage value={watchMessage} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </FormCardContent>
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
                {pageComponents.length ? (
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          id="all"
                          checked={
                            field.value?.length === pageComponents.length
                          }
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked ? pageComponents.map((c) => c.id) : [],
                            );
                          }}
                        />
                      </FormControl>
                      <Label htmlFor="all">Select all</Label>
                    </div>
                    {pageComponents.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            id={String(item.id)}
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...(field.value || []), item.id]
                                : field.value?.filter((id) => id !== item.id);
                              field.onChange(newValue);
                            }}
                          />
                        </FormControl>
                        <Label htmlFor={String(item.id)}>{item.name}</Label>
                      </div>
                    ))}
                  </div>
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
                          Send email notification to subscribers
                        </Label>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Subscribers will receive an email when creating a
                      maintenance.
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
