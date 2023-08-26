"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import {
  insertMonitorSchema,
  periodicityEnum,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { regionsDict } from "@/data/regions-dictionary";
import { useToastAction } from "@/hooks/use-toast-action";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";
import { LoadingAnimation } from "../loading-animation";

const cronJobs = [
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
] as const;

type MonitorProps = z.infer<typeof insertMonitorSchema>;

interface Props {
  defaultValues?: MonitorProps;
  workspaceSlug: string;
  plan?: "free" | "pro"; // HOTFIX - We can think of returning `workspace` instead of `workspaceSlug`
}

export function MonitorForm({
  defaultValues,
  workspaceSlug,
  plan = "free",
}: Props) {
  const form = useForm<MonitorProps>({
    resolver: zodResolver(insertMonitorSchema), // too much - we should only validate the values we ask inside of the form!
    defaultValues: {
      url: defaultValues?.url || "",
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      periodicity: defaultValues?.periodicity || "30m",
      active: defaultValues?.active ?? true,
      id: defaultValues?.id || undefined,
      regions: defaultValues?.regions || [],
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToastAction();

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
          router.replace(`./edit?id=${monitor?.id}`); // to stay on same page and enable 'Advanced' tab
        }
        router.refresh();
        toast("saved");
      } catch {
        toast("error");
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
              <FormDescription>
                The name of the monitor displayed on the status page.
              </FormDescription>
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
                {/* Should we use `InputWithAddons here? */}
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
                Provide your users with information about it.{" "}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="periodicity"
          render={({ field }) => (
            <FormItem className="sm:col-span-3 sm:self-baseline">
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
            <FormItem className="flex flex-row items-center justify-between sm:col-span-3">
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
          <Button className="w-full sm:w-auto">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
