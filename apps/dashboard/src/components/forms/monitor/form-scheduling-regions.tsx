"use client";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  monitorPeriodicity,
  type MonitorFlyRegion,
} from "@openstatus/db/src/schema/constants";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { groupByContinent } from "@openstatus/utils";
import { isTRPCClientError } from "@trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

const DEFAULT_PERIODICITY = "10m";
const DEFAULT_REGIONS = ["ams", "fra", "iad", "syd", "jnb", "gru"];
const PERIODICITY = monitorPeriodicity.filter((p) => p !== "other");

const schema = z.object({
  regions: z.array(z.string()),
  periodicity: z.enum(monitorPeriodicity),
});

type FormValues = z.infer<typeof schema>;

export function FormSchedulingRegions({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      regions: DEFAULT_REGIONS,
      periodicity: DEFAULT_PERIODICITY,
    },
  });
  const [isPending, startTransition] = useTransition();
  const watchPeriodicity = form.watch("periodicity");
  const watchRegions = form.watch("regions");
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
            console.error(error);
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
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Scheduling & Regions</FormCardTitle>
            <FormCardDescription>
              Configure the scheduling and regions for your monitor.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="periodicity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periodicity</FormLabel>
                  <FormControl>
                    <div>
                      <Slider
                        value={[monitorPeriodicity.indexOf(field.value)]}
                        max={PERIODICITY.length - 1}
                        aria-label="Slider with ticks"
                        onValueChange={(value) => {
                          field.onChange(PERIODICITY[value[0]]);
                        }}
                        className={cn(
                          !workspace?.limits.periodicity.includes(
                            watchPeriodicity
                          ) && "[&_[data-slot=slider-range]]:bg-destructive"
                        )}
                      />
                      <span
                        className="mt-3 flex w-full items-center justify-between gap-1 px-2.5 font-medium text-muted-foreground text-xs"
                        aria-hidden="true"
                      >
                        {PERIODICITY.map((period) => (
                          <span
                            key={period}
                            className="flex w-0 flex-col items-center justify-center gap-2"
                          >
                            <span
                              className={cn("h-1 w-px bg-muted-foreground/70")}
                            />
                            {period}
                          </span>
                        ))}
                      </span>
                    </div>
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
              name="regions"
              render={() => (
                <FormItem>
                  <FormControl>
                    <div className="grid gap-4">
                      {Object.entries(groupByContinent).map(
                        ([continent, r]) => {
                          const selected = r.reduce((prev, curr) => {
                            return (
                              prev + (watchRegions.includes(curr.code) ? 1 : 0)
                            );
                          }, 0);
                          const isAllSelected = selected === r.length;

                          return (
                            <div key={continent} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <FormLabel>
                                  {continent}{" "}
                                  <span className="align-baseline font-mono font-normal text-muted-foreground/70 text-xs tabular-nums">
                                    ({selected}/{r.length})
                                  </span>
                                </FormLabel>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  className={cn(
                                    isAllSelected && "text-muted-foreground"
                                  )}
                                  onClick={() => {
                                    if (!isAllSelected) {
                                      // Add all regions from this continent
                                      const newRegions = [...watchRegions];
                                      r.forEach((region) => {
                                        if (!newRegions.includes(region.code)) {
                                          newRegions.push(region.code);
                                        }
                                      });
                                      form.setValue("regions", newRegions);
                                    } else {
                                      // Remove all regions from this continent
                                      form.setValue(
                                        "regions",
                                        watchRegions?.filter(
                                          (region) =>
                                            !r
                                              .map(({ code }) => code)
                                              .includes(
                                                region as MonitorFlyRegion
                                              )
                                        )
                                      );
                                    }
                                  }}
                                >
                                  Select all
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {r.map((region) => {
                                  return (
                                    <FormField
                                      key={region.code}
                                      control={form.control}
                                      name="regions"
                                      render={({ field }) => (
                                        <FormItem
                                          key={region.code}
                                          className="flex items-center"
                                        >
                                          <Checkbox
                                            id={region.code}
                                            checked={
                                              field.value?.includes(
                                                region.code
                                              ) || false
                                            }
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                field.onChange([
                                                  ...field.value,
                                                  region,
                                                ]);
                                              } else {
                                                field.onChange(
                                                  field.value?.filter(
                                                    (r) => r !== region.code
                                                  )
                                                );
                                              }
                                            }}
                                          />
                                          <FormLabel
                                            htmlFor={region.code}
                                            className="w-full truncate font-mono font-normal text-sm"
                                          >
                                            <span className="text-nowrap">
                                              {region.code} {region.flag}
                                            </span>
                                            <span className="truncate font-normal text-muted-foreground text-xs leading-[inherit]">
                                              {region.location}
                                            </span>
                                          </FormLabel>
                                        </FormItem>
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about <Link href="#">Regions</Link> and{" "}
              <Link href="#">Periodicity</Link>.
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
