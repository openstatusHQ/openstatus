"use client";

import { METHODS } from "http";
import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Wand2, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";

import { not } from "@openstatus/db";
import type { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  insertMonitorSchema,
  notification,
  periodicityEnum,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
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
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { regionsDict } from "@/data/regions-dictionary";
import { useToastAction } from "@/hooks/use-toast-action";
import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";
import { LoadingAnimation } from "../loading-animation";
import { NotificationDialog } from "./notification-dialog";

const cronJobs = [
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
] as const;

const methods = ["POST", "GET"] as const;
const methodsEnum = z.enum(methods);

const headersSchema = z
  .array(z.object({ key: z.string(), value: z.string() }))
  .optional();

const advancedSchema = z.object({
  method: methodsEnum,
  body: z.string().optional(),
  headers: headersSchema,
});

const mergedSchema = insertMonitorSchema.merge(advancedSchema);

type MonitorProps = z.infer<typeof mergedSchema>;

interface Props {
  defaultValues?: MonitorProps;
  workspaceSlug: string;
  plan?: "free" | "pro";
  notifications?: z.infer<typeof selectNotificationSchema>[]; // HOTFIX - We can think of returning `workspace` instead of `workspaceSlug`
}

export function MonitorForm({
  defaultValues,
  workspaceSlug,
  plan = "free",
  notifications,
}: Props) {
  const form = useForm<MonitorProps>({
    resolver: zodResolver(mergedSchema), // too much - we should only validate the values we ask inside of the form!
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || "30m",
      active: defaultValues?.active ?? true,
      id: defaultValues?.id || undefined,
      regions: defaultValues?.regions || [],
      headers: Boolean(defaultValues?.headers?.length)
        ? defaultValues?.headers
        : [{ key: "", value: "" }],
      body: defaultValues?.body ?? "",
      method: defaultValues?.method ?? "GET",
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [isTestPending, startTestTransition] = React.useTransition();
  const { toast } = useToastAction();
  const watchMethod = form.watch("method");
  const updateSearchParams = useUpdateSearchParams();

  const { fields, append, remove } = useFieldArray({
    name: "headers",
    control: form.control,
  });

  const onSubmit = ({ ...props }: MonitorProps) => {
    startTransition(async () => {
      try {
        // TODO: we could use an upsertPage function instead - insert if not exist otherwise update
        if (defaultValues) {
          await api.monitor.updateMonitor.mutate(props);
        } else {
          const monitor = await api.monitor.createMonitor.mutate({
            data: props,
            workspaceSlug,
          });
          const id = monitor?.id || null;
          router.replace(`?${updateSearchParams({ id })}`);
        }
        router.refresh();
        toast("saved");
      } catch {
        toast("error");
      }
    });
  };

  const validateJSON = (value?: string) => {
    if (!value) return;
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      form.clearErrors("body");
      return obj;
    } catch (e) {
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

  const sendTestPing = () => {
    startTestTransition(async () => {
      const res = await fetch(`/api/checker/test`, {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          url: form.getValues("url"),
          body: form.getValues("body"),
          method: form.getValues("method"),
          headers: form.getValues("headers"),
        }),
      });
      if (res.ok) {
        toast("test-success");
      } else {
        toast("test-error");
      }
    });
  };

  const limit = allPlans[plan].limits.periodicity;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Documenso" {...field} />
              </FormControl>
              <FormDescription>Displayed on the status page.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="sm:col-span-5">
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
          name="method"
          render={({ field }) => (
            <FormItem className="sm:col-span-1 sm:col-start-1 sm:self-baseline">
              <FormLabel>Method</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(methodsEnum.parse(value));
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
                  {methods.map((method) => (
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
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="sm:col-span-4">
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
        <div className="space-y-2 sm:col-span-full">
          {/* TODO: add FormDescription for latest key/value */}
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
              size="sm"
              onClick={() => append({ key: "", value: "" })}
            >
              Add Custom Header
            </Button>
          </div>
        </div>
        {watchMethod === "POST" && (
          <div className="sm:col-span-4 sm:col-start-1">
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
                  <FormDescription>Write your json payload.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        <div className="sm:col-span-2 sm:col-start-1">
          <Button
            type="button"
            variant="default"
            className="w-full md:w-auto"
            size="lg"
            onClick={sendTestPing}
          >
            {!isTestPending ? "Test Request" : <LoadingAnimation />}
          </Button>
        </div>

        <div className="sm:col-span-2 sm:col-start-1">
          <>
            {notifications?.map((notification) => (
              // We should be able to delete them as well
              <Badge key={notification.id}> {notification.name} </Badge>
            ))}
            <NotificationDialog />
          </>
        </div>
        <FormField
          control={form.control}
          name="periodicity"
          render={({ field }) => (
            <FormItem className="sm:col-span-3 sm:col-start-1 sm:self-baseline">
              <FormLabel>Frequency</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(periodicityEnum.parse(value))
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
                      disabled={!limit.includes(value)}
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
          render={({ field }) => (
            <FormItem className="sm:col-span-3 sm:self-baseline">
              <FormLabel>Regions</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "h-10 w-full justify-between",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {/* This is a hotfix */}
                      {field.value?.length === 1 && field.value[0].length > 0
                        ? regionsDict[
                            field.value[0] as keyof typeof regionsDict
                          ].location
                        : "Select region"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Select a region..." />
                    <CommandEmpty>No regions found.</CommandEmpty>
                    <CommandGroup className="max-h-[150px] overflow-y-scroll">
                      {Object.keys(regionsDict).map((region) => {
                        const { code, location } =
                          regionsDict[region as keyof typeof regionsDict];
                        const isSelected = field.value?.includes(code);
                        return (
                          <CommandItem
                            value={code}
                            key={code}
                            onSelect={() => {
                              form.setValue("regions", [code]); // TODO: allow more than one to be selected in the future
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {location}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormDescription>
                Select your region. Leave blank for random picked regions.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between sm:col-span-4">
              <div className="space-y-0.5">
                <FormLabel>Active</FormLabel>
                <FormDescription>
                  This will start ping your endpoint on based on the selected
                  frequence.
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
        <div className="sm:col-span-full">
          {/*
           * We could think of having a 'double confirmation' one,
           * to check if the endpoint works and approve afterwards
           * and confirm anyways even if endpoint failed
           */}
          <Button className="w-full sm:w-auto" size="lg" disabled={isPending}>
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
