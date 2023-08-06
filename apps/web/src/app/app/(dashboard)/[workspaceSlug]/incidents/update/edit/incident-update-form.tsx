// move into @/components/forms/ later
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import type { allMonitorsSchema } from "@openstatus/db/src/schema";
import {
  availableStatus,
  insertIncidentUpdateSchema,
  StatusEnum,
} from "@openstatus/db/src/schema";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { statusDict } from "@/data/incidents-dictionary";
import { api } from "@/trpc/client";

type IncidentUpdateProps = z.infer<typeof insertIncidentUpdateSchema>;

interface Props {
  defaultValues?: IncidentUpdateProps;
  workspaceSlug: string;
  incidentId: number;
}

export function IncidentUpdateForm({
  defaultValues,
  workspaceSlug,
  incidentId,
}: Props) {
  const form = useForm<IncidentUpdateProps>({
    resolver: zodResolver(insertIncidentUpdateSchema),
    defaultValues: {
      id: defaultValues?.id || 0,
      status: defaultValues?.status || "investigating",
      message: defaultValues?.message || "",
      date: defaultValues?.date || new Date().getTime(),
      incidentId,
      workspaceSlug,
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const onSubmit = ({ ...props }: IncidentUpdateProps) => {
    console.log(props);
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.incident.updateIncidentUpdate.mutate({ ...props });
        } else {
          await api.incident.createIncidentUpdate.mutate({ ...props });
        }
        router.push("../");
        router.refresh();
      } catch {
        toast({
          title: "Something went wrong.",
          description: "Please try again.",
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
      >
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="col-span-full space-y-1">
              <FormLabel>Status</FormLabel>
              <FormDescription>Select the current status.</FormDescription>
              <FormMessage />
              <RadioGroup
                onValueChange={(value) =>
                  field.onChange(StatusEnum.parse(value))
                } // value is a string
                defaultValue={field.value}
                className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8"
              >
                {availableStatus.map((status) => {
                  const { value, label, icon } = statusDict[status];
                  const Icon = Icons[icon];
                  return (
                    <FormItem key={value}>
                      <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:text-foreground">
                        <FormControl>
                          <RadioGroupItem value={value} className="sr-only" />
                        </FormControl>
                        <div className="border-border text-muted-foreground flex w-full items-center justify-center rounded-lg border p-2 px-6 py-3 text-center">
                          <Icon className="mr-2 h-4 w-4" />
                          {label}
                        </div>
                      </FormLabel>
                    </FormItem>
                  );
                })}
              </RadioGroup>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message" // TODO: support markdown and add a `Tabs` switch between "Write" and "Preview"
          render={({ field }) => (
            <FormItem className="sm:col-span-4">
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="We are encountering..."
                  className="w-full resize-none"
                  rows={7}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Tell your user what's happening.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col sm:col-span-full">
              <FormLabel>Date</FormLabel>
              <DateTimePicker
                date={new Date(field.value)}
                setDate={(date) => {
                  field.onChange(date.getTime());
                }}
              />
              <FormDescription>
                The date and time when the incident took place.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-full">
          <Button className="w-full sm:w-auto">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
