"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { monitorMaintenanceWindowModes } from "@openstatus/db/src/schema/monitor_maintenance_windows/constants";
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
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { addHours } from "date-fns";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import {
  maintenanceWindowModeDescriptions,
  maintenanceWindowModeLabels,
} from "@/data/maintenance-windows.client";

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    mode: z.enum(monitorMaintenanceWindowModes),
    from: z.date(),
    to: z.date(),
    monitorIds: z.array(z.number()).min(1, "Select at least one monitor"),
  })
  .refine((data) => data.to > data.from, {
    error: "End date cannot be earlier than start date.",
    path: ["to"],
  });

export type FormValues = z.infer<typeof schema>;

export function FormMaintenanceWindow({
  defaultValues,
  monitors,
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValue"> & {
  defaultValues?: Partial<FormValues>;
  monitors: { id: number; name: string; url: string }[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      mode: "pause",
      from: new Date(),
      to: addHours(new Date(), 1),
      monitorIds: [],
      ...defaultValues,
    },
  });
  const watchTo = form.watch("to");
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
          error: (error) =>
            isTRPCClientError(error) ? error.message : "Failed to save",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  const zoneNote = (
    <>
      Shown in your timezone (
      <code className="font-commit-mono text-foreground/70">{timezone}</code>).
    </>
  );

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
                  <Input placeholder="Database upgrade..." {...field} />
                </FormControl>
                <FormDescription>
                  Internal only. Nothing is shown on a status page.
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
            name="from"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    className="w-[240px]"
                    onChange={(date) => {
                      // a start moved past the end drags the end along, keeping the duration
                      if (watchTo && date > watchTo) {
                        const duration =
                          watchTo.getTime() - field.value.getTime();
                        form.setValue(
                          "to",
                          new Date(date.getTime() + duration),
                        );
                      }
                      field.onChange(date);
                    }}
                  />
                </FormControl>
                <FormDescription>{zoneNote}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="to"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    className="w-[240px]"
                  />
                </FormControl>
                <FormDescription>{zoneNote}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Checks</FormLabel>
                <FormDescription>
                  Monitors under a reporting usually want to keep checking, so
                  the time can still be judged or excused.
                </FormDescription>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid gap-2"
                  >
                    {monitorMaintenanceWindowModes.map((mode) => (
                      <Label
                        key={mode}
                        htmlFor={`window-mode-${mode}`}
                        className="hover:bg-muted/50 has-data-[state=checked]:bg-muted/50 flex items-start gap-3 rounded-lg border p-3 font-normal"
                      >
                        <RadioGroupItem
                          value={mode}
                          id={`window-mode-${mode}`}
                        />
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">
                            {maintenanceWindowModeLabels[mode]}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {maintenanceWindowModeDescriptions[mode]}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
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
            name="monitorIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Every selected monitor is in maintenance for the whole window.
                </FormDescription>
                {monitors.length ? (
                  <div className="grid gap-2">
                    {monitors.map((monitor) => {
                      const id = `window-monitor-${monitor.id}`;
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
                            <span className="text-muted-foreground truncate font-mono text-xs">
                              {monitor.url}
                            </span>
                          </span>
                        </Label>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No monitors found</EmptyStateTitle>
                  </EmptyStateContainer>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
