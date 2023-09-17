"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import type { allMonitorsExtendedSchema } from "@openstatus/db/src/schema";
import {
  availableStatus,
  insertIncidentSchema,
  StatusEnum,
} from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/src/components/button";
import { Checkbox } from "@openstatus/ui/src/components/checkbox";
import { DateTimePicker } from "@openstatus/ui/src/components/date-time-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/src/components/form";
import { Input } from "@openstatus/ui/src/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/src/components/radio-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/src/components/tabs";
import { Textarea } from "@openstatus/ui/src/components/textarea";

import { Preview } from "@/components/content/preview";
import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import { statusDict } from "@/data/incidents-dictionary";
import { useToastAction } from "@/hooks/use-toast-action";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";

// include update on creation
const insertSchema = insertIncidentSchema.extend({
  message: z.string().optional(),
  date: z.date().optional().default(new Date()),
});

type IncidentProps = z.infer<typeof insertSchema>;
type MonitorsProps = z.infer<typeof allMonitorsExtendedSchema>;

interface Props {
  defaultValues?: IncidentProps;
  monitors?: MonitorsProps;
  workspaceSlug: string;
}

export function IncidentForm({
  defaultValues,
  monitors,
  workspaceSlug,
}: Props) {
  const form = useForm<IncidentProps>({
    resolver: zodResolver(insertSchema),
    defaultValues: {
      id: defaultValues?.id || 0,
      title: defaultValues?.title || "",
      status: defaultValues?.status || "investigating",
      monitors: defaultValues?.monitors || [],
      workspaceSlug,
      // include update on creation
      message: "",
      date: defaultValues?.date || new Date(),
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToastAction();

  const onSubmit = ({ ...props }: IncidentProps) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.incident.updateIncident.mutate({ ...props });
        } else {
          // or use createIncident to create automaticaaly an IncidentUpdate?
          const { message, date, status, workspaceSlug, ...rest } = props;
          const incident = await api.incident.createIncident.mutate({
            workspaceSlug,
            status,
            ...rest,
          });
          // include update on creation
          if (incident?.id) {
            await api.incident.createIncidentUpdate.mutate({
              message,
              date,
              status,
              workspaceSlug,
              incidentId: incident.id,
            });
          }
        }
        toast("saved");
        router.refresh();
      } catch {
        toast("error");
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
          name="title"
          render={({ field }) => (
            <FormItem className="sm:col-span-4">
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
              <FormDescription>The title of your page.</FormDescription>
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
        {/* include update on creation */}
        {!defaultValues ? (
          <div className="bg-accent/40 border-border col-span-full -m-3 grid gap-6 rounded-lg border p-3 sm:grid-cols-6">
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
                          rows={7}
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
                <FormItem className="flex flex-col sm:col-span-full">
                  <FormLabel>Date</FormLabel>
                  <DateTimePicker
                    date={field.value ? new Date(field.value) : new Date()}
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
        ) : null}
        <FormField
          control={form.control}
          name="monitors"
          render={() => (
            <FormItem className="sm:col-span-full">
              <div className="mb-4">
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Select the monitors that you want to refer the incident to.
                </FormDescription>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {monitors?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="monitors"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    );
                              }}
                            />
                          </FormControl>
                          <div className="grid gap-1.5 leading-none">
                            <div className="flex items-center gap-2">
                              <FormLabel className="font-normal">
                                {item.name}
                              </FormLabel>
                              <span
                                className={cn(
                                  "rounded-full p-1",
                                  item.active ? "bg-green-500" : "bg-red-500",
                                )}
                              ></span>
                            </div>
                            <p className="text-muted-foreground truncate text-sm">
                              {item.description}
                            </p>
                          </div>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
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
