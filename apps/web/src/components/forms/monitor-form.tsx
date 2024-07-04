// REMINDER: legacy form - please use /forms/monitor/form.tsx

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";

import type {
  InsertMonitor,
  Notification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  flyRegions,
  insertMonitorSchema,
  monitorMethods,
  monitorMethodsSchema,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema";
import { getLimit } from "@openstatus/plans";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Dialog,
  DialogTrigger,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import { LoadingAnimation } from "@/components/loading-animation";
import { FailedPingAlertConfirmation } from "@/components/modals/failed-ping-alert-confirmation";
import type { RegionChecker } from "@/components/ping-response-analysis/utils";
import { toastAction } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";

const cronJobs = [
  { value: "30s", label: "30 seconds" },
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
] as const;

interface Props {
  defaultValues?: InsertMonitor;
  plan?: WorkspacePlan;
  notifications?: Notification[];
  nextUrl?: string;
}

export function MonitorForm({
  defaultValues,
  plan = "free",
  notifications,
  nextUrl,
}: Props) {
  const form = useForm<InsertMonitor>({
    resolver: zodResolver(insertMonitorSchema),
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || "30m",
      active: defaultValues?.active ?? true,
      id: defaultValues?.id || 0,
      regions: defaultValues?.regions || getLimit("free", "regions"),
      headers: defaultValues?.headers?.length
        ? defaultValues?.headers
        : [{ key: "", value: "" }],
      body: defaultValues?.body ?? "",
      method: defaultValues?.method ?? "GET",
      notifications: defaultValues?.notifications ?? [],
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [isTestPending, startTestTransition] = React.useTransition();
  const [pingFailed, setPingFailed] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const watchMethod = form.watch("method");

  const { fields, append, remove } = useFieldArray({
    name: "headers",
    control: form.control,
  });

  const handleDataUpdateOrInsertion = async (props: InsertMonitor) => {
    try {
      if (defaultValues) {
        await api.monitor.update.mutate(props);
      } else {
        await api.monitor.create.mutate(props);
      }
      if (nextUrl) {
        router.push(nextUrl);
      }
      router.refresh();
      toastAction("saved");
    } catch (_error) {
      toastAction("error");
    }
  };

  const onSubmit = ({ ...props }: InsertMonitor) => {
    startTransition(async () => {
      const pingResult = await pingEndpoint();
      if (!pingResult) {
        setPingFailed(true);
        return;
      }
      await handleDataUpdateOrInsertion(props);
    });
  };

  const validateJSON = (value?: string) => {
    if (!value) return;
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      form.clearErrors("body");
      return obj;
    } catch (_e) {
      form.setError("body", {
        message: "Not a valid JSON object",
      });
      return false;
    }
  };

  const onPrettifyJSON = () => {
    const body = form.getValues("body");
    const obj = validateJSON(body);
    if (obj) {
      const pretty = JSON.stringify(obj, undefined, 4);
      form.setValue("body", pretty);
    }
  };

  const pingEndpoint = async () => {
    const { url, body, method, headers } = form.getValues();
    const res = await fetch("/api/checker/test", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ url, body, method, headers }),
    });
    const data = (await res.json()) as RegionChecker;
    return data;
  };

  const sendTestPing = () => {
    if (isTestPending) {
      return;
    }
    const { url } = form.getValues();
    if (!url) {
      toastAction("test-warning-empty-url");
      return;
    }

    startTestTransition(async () => {
      try {
        const data = await pingEndpoint();
        if (data.status >= 200 && data.status < 300) {
          toastAction("test-success");
        } else {
          toastAction("test-error");
        }
      } catch {
        toastAction("error");
      }
    });
  };

  const periodicityLimit = getLimit(plan, "periodicity");
  const notificationLimit = getLimit(plan, "notification-channels");
  const notificationLimitReached = notifications
    ? notifications.length >= notificationLimit
    : false;

  return (
    <Dialog open={openDialog} onOpenChange={(val) => setOpenDialog(val)}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid w-full gap-6"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="my-1.5 flex flex-col gap-2">
              <p className="font-semibold text-sm leading-none">
                Endpoint Check
              </p>
              <p className="text-muted-foreground text-sm">
                The easiest way to get started.
              </p>
            </div>
            <div className="grid gap-6 sm:col-span-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Documenso" {...field} />
                    </FormControl>
                    <FormDescription>
                      Displayed on the status page.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      {/* <InputWithAddons
                  leading="https://"
                  placeholder="documenso.com/api/health"
                  {...field}
                /> */}
                      <Input
                        placeholder="https://documenso.com/api/health"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Here is the URL you want to monitor.{" "}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <Accordion type="single" collapsible>
            <AccordionItem value="http-request-settings">
              <AccordionTrigger>HTTP Request Settings</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="my-1.5 flex flex-col gap-2">
                    <p className="font-semibold text-sm leading-none">
                      Custom Request
                    </p>
                    <p className="text-muted-foreground text-sm">
                      If your endpoint is secured, add additional configuration
                      to the request we send.
                    </p>
                  </div>
                  <div className="grid gap-6 sm:col-span-2 sm:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1 sm:self-baseline">
                          <FormLabel>Method</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(monitorMethodsSchema.parse(value));
                              form.resetField("body", { defaultValue: "" });
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {monitorMethods.map((method) => (
                                <SelectItem key={method} value={method}>
                                  {method}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2 sm:col-span-full">
                      <FormLabel>Request Header</FormLabel>
                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-6 gap-6">
                          <FormField
                            control={form.control}
                            name={`headers.${index}.key`}
                            render={({ field }) => (
                              <FormItem className="col-span-2">
                                <FormControl>
                                  <Input placeholder="key" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="col-span-4 flex items-center space-x-2">
                            <FormField
                              control={form.control}
                              name={`headers.${index}.value`}
                              render={({ field }) => (
                                <FormItem className="w-full">
                                  <FormControl>
                                    <Input placeholder="value" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              type="button"
                              onClick={() => remove(Number(field.id))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => append({ key: "", value: "" })}
                        >
                          Add Custom Header
                        </Button>
                      </div>
                    </div>
                    {watchMethod === "POST" && (
                      <div className="sm:col-span-full">
                        <FormField
                          control={form.control}
                          name="body"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-end justify-between">
                                <FormLabel>Body</FormLabel>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={onPrettifyJSON}
                                      >
                                        <Wand2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Prettify JSON</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <FormControl>
                                <Textarea
                                  rows={8}
                                  placeholder='{ "hello": "world" }'
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Write your json payload.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="advanced-settings">
              <AccordionTrigger>Advanced Settings</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="my-1.5 flex flex-col gap-2">
                    <p className="font-semibold text-sm leading-none">
                      More Configurations
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Make it your own. Contact us if you wish for more and we
                      will implement it!
                    </p>
                  </div>
                  <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="periodicity"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1 sm:self-baseline">
                          <FormLabel>Frequency</FormLabel>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(
                                monitorPeriodicitySchema.parse(value)
                              )
                            }
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="How often should it check your endpoint?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cronJobs.map(({ label, value }) => (
                                <SelectItem
                                  key={value}
                                  value={value}
                                  disabled={!periodicityLimit.includes(value)}
                                >
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Frequency of how often your endpoint will be pinged.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="regions"
                      render={({ field }) => {
                        const numberOfSelectedRegions =
                          field.value?.length || 0;
                        function renderText() {
                          if (numberOfSelectedRegions === 0)
                            return "Select region";
                          if (numberOfSelectedRegions === flyRegions.length)
                            return "All regions";
                          return `${numberOfSelectedRegions} regions`;
                        }
                        return (
                          <FormItem className="sm:col-span-1 sm:self-baseline">
                            <FormLabel>Regions</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "h-10 w-full justify-between",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {renderText()}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput placeholder="Select a region..." />
                                  <CommandEmpty>No regions found.</CommandEmpty>
                                  <CommandGroup className="max-h-[150px] overflow-y-scroll">
                                    {Object.keys(flyRegionsDict).map(
                                      (region) => {
                                        const { code, location } =
                                          flyRegionsDict[
                                            region as keyof typeof flyRegionsDict
                                          ];
                                        const isSelected =
                                          field.value?.includes(code);
                                        return (
                                          <CommandItem
                                            value={code}
                                            key={code}
                                            onSelect={() => {
                                              const currentRegions =
                                                form.getValues("regions") || [];
                                              form.setValue(
                                                "regions",
                                                currentRegions.includes(code)
                                                  ? currentRegions.filter(
                                                      (r) => r !== code
                                                    )
                                                  : [...currentRegions, code]
                                              );
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                isSelected
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {location}
                                          </CommandItem>
                                        );
                                      }
                                    )}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Select your regions. If none, region will be
                              random.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Determines the api health of our services."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide your users with information about it.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between sm:col-span-full">
                          <div className="space-y-0.5">
                            <FormLabel>Active</FormLabel>
                            <FormDescription>
                              This will start ping your endpoint on based on the
                              selected frequence.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={(value) => field.onChange(value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="notification-settings">
              <AccordionTrigger>Notification Settings</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="my-1.5 flex flex-col gap-2">
                    <p className="font-semibold text-sm leading-none">Alerts</p>
                    <p className="text-muted-foreground text-sm">
                      How do you want to get informed if things break?
                    </p>
                  </div>
                  <div className="grid gap-6 sm:col-span-2">
                    <FormField
                      control={form.control}
                      name="notifications"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">
                              Notifications
                            </FormLabel>
                            <FormDescription>
                              Select the notification channels you want to be
                              informed.
                            </FormDescription>
                          </div>
                          {notifications?.map((item) => (
                            <FormField
                              key={item.id}
                              control={form.control}
                              name="notifications"
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
                                                  (value) => value !== item.id
                                                )
                                              );
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="font-normal">
                                        {item.name}
                                      </FormLabel>
                                      <FormDescription>
                                        {item.provider}
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                          <FormMessage />
                          <div className="sm:col-span-2 sm:col-start-1">
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={notificationLimitReached}
                              >
                                Add Notifications
                              </Button>
                            </DialogTrigger>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="grid justify-end gap-3">
            <div className="flex flex-col gap-6 sm:col-span-full sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                size="lg"
                onClick={sendTestPing}
              >
                {!isTestPending ? (
                  "Test Request"
                ) : (
                  <LoadingAnimation variant="inverse" />
                )}
              </Button>
              <Button
                className="w-full sm:w-auto"
                size="lg"
                disabled={isPending}
              >
                {!isPending ? "Confirm" : <LoadingAnimation />}
              </Button>
            </div>
            <div className="flex w-full justify-end">
              <p className="text-muted-foreground text-xs">
                We test your endpoint connection on submit.
              </p>
            </div>
          </div>
        </form>
      </Form>
      <FailedPingAlertConfirmation
        monitor={form.getValues()}
        {...{ pingFailed, setPingFailed }}
        onConfirm={handleDataUpdateOrInsertion}
      />
    </Dialog>
  );
}
