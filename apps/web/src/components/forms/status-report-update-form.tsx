"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import type { InsertStatusReportUpdate } from "@openstatus/db/src/schema";
import {
  insertStatusReportUpdateSchema,
  statusReportStatus,
  statusReportStatusSchema,
} from "@openstatus/db/src/schema";
import {
  Button,
  DateTimePicker,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RadioGroup,
  RadioGroupItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@openstatus/ui";

import { Preview } from "@/components/content/preview";
import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { statusDict } from "@/data/incidents-dictionary";
import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

interface Props {
  defaultValues?: InsertStatusReportUpdate;
  statusReportId: number;
  onSubmit?: () => void;
}

export function StatusReportUpdateForm({
  defaultValues,
  statusReportId,
  onSubmit,
}: Props) {
  const form = useForm<InsertStatusReportUpdate>({
    resolver: zodResolver(insertStatusReportUpdateSchema),
    defaultValues: {
      id: defaultValues?.id || 0,
      status: defaultValues?.status || "investigating",
      message: defaultValues?.message,
      date: defaultValues?.date || new Date(),
      statusReportId,
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = ({ ...props }: InsertStatusReportUpdate) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.statusReport.updateStatusReportUpdate.mutate({ ...props });
        } else {
          await api.statusReport.createStatusReportUpdate.mutate({ ...props });
        }
        toastAction("saved");
        onSubmit?.();
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(handleSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="my-1.5 flex flex-col gap-2">
            <p className="font-semibold text-sm leading-none">Inform</p>
            <p className="text-muted-foreground text-sm">
              Keep your users informed about what just happened.
            </p>
          </div>
          <div className="grid gap-6 sm:col-span-2 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-1 sm:col-span-full">
                  <FormLabel>Status</FormLabel>
                  <FormDescription>Select the current status.</FormDescription>
                  <FormMessage />
                  <RadioGroup
                    onValueChange={(value) =>
                      field.onChange(statusReportStatusSchema.parse(value))
                    } // value is a string
                    defaultValue={field.value}
                    className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                  >
                    {statusReportStatus.map((status) => {
                      const { value, label, icon } = statusDict[status];
                      const Icon = Icons[icon];
                      return (
                        <FormItem key={value}>
                          <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:text-foreground">
                            <FormControl>
                              <RadioGroupItem
                                value={value}
                                className="sr-only"
                              />
                            </FormControl>
                            <div className="flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-center text-muted-foreground text-sm">
                              <Icon className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">{label}</span>
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
              name="message"
              render={({ field }) => (
                <FormItem className="sm:col-span-full">
                  <FormLabel>Message</FormLabel>
                  <Tabs defaultValue="write">
                    <TabsList>
                      <TabsTrigger value="write">Write</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write">
                      <FormControl>
                        <Textarea
                          placeholder="We are encountering..."
                          className="h-auto w-full resize-none"
                          rows={9}
                          {...field}
                        />
                      </FormControl>
                    </TabsContent>
                    <TabsContent value="preview">
                      <Preview md={form.getValues("message")} />
                    </TabsContent>
                  </Tabs>
                  <FormDescription>
                    Tell your user what&apos;s happening. Supports markdown.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col sm:col-span-2">
                  <FormLabel>Date</FormLabel>
                  <DateTimePicker
                    className="w-full"
                    date={new Date(field.value)}
                    setDate={(date) => {
                      field.onChange(date);
                    }}
                  />
                  <FormDescription>
                    The date and time when the incident took place.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex sm:justify-end">
          <Button className="w-full sm:w-auto" size="lg">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
