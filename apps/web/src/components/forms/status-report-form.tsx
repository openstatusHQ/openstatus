"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import {
  insertStatusReportSchema,
  statusReportStatus,
  statusReportStatusSchema,
} from "@openstatus/db/src/schema";
import type {
  InsertStatusReport,
  Monitor,
  Page,
} from "@openstatus/db/src/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  DateTimePickerPopover,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
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
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";

interface Props {
  defaultValues?: InsertStatusReport;
  monitors?: Monitor[];
  pages?: Page[];
  nextUrl?: string;
}

export function StatusReportForm({
  defaultValues,
  monitors,
  pages,
  nextUrl,
}: Props) {
  const form = useForm<InsertStatusReport>({
    resolver: zodResolver(insertStatusReportSchema),
    defaultValues: defaultValues
      ? {
          id: defaultValues.id,
          title: defaultValues.title,
          status: defaultValues.status,
          // include update on creation
          message: defaultValues.message,
          date: defaultValues.date,
        }
      : {
          status: "investigating",
          date: new Date(),
        },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onSubmit = ({ ...props }: InsertStatusReport) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.statusReport.updateStatusReport.mutate({ ...props });
        } else {
          const { message, date, status, ...rest } = props;
          const statusReport = await api.statusReport.createStatusReport.mutate(
            {
              status,
              message,
              ...rest,
            }
          );
          // include update on creation
          if (statusReport?.id) {
            await api.statusReport.createStatusReportUpdate.mutate({
              message,
              date,
              status,
              statusReportId: statusReport.id,
            });
          }
        }
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
        toastAction("saved");
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
          form.handleSubmit(onSubmit)(e);
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
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-4">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Downtime..." {...field} />
                  </FormControl>
                  <FormDescription>The title of your outage.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          </div>
        </div>
        {/* include update on creation */}
        {!defaultValues ? (
          <Accordion type="single" defaultValue="message" collapsible>
            <AccordionItem value="message">
              <AccordionTrigger>Message</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="my-1.5 flex flex-col gap-2">
                    <p className="font-semibold text-sm leading-none">
                      Status Update
                    </p>
                    <p className="text-muted-foreground text-sm">
                      What is actually going wrong?
                    </p>
                  </div>
                  <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-4">
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
                            Tell your user what&apos;s happening. Supports
                            markdown.
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
                          <DateTimePickerPopover
                            date={
                              field.value ? new Date(field.value) : new Date()
                            }
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
        <div className="flex sm:justify-end">
          <Button className="w-full sm:w-auto" size="lg">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
