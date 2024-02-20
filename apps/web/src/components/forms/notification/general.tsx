"use client";

import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertNotification,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  notificationProvider,
  notificationProviderSchema,
} from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { toCapitalize } from "@/lib/utils";
import { SectionHeader } from "../shared/section-header";
import { getProviderMetaData } from "./config";

interface Props {
  form: UseFormReturn<InsertNotification>;
  plan: WorkspacePlan;
}

export function General({ form, plan }: Props) {
  const watchProvider = form.watch("provider");
  const providerMetaData = useMemo(
    () => getProviderMetaData(watchProvider),
    [watchProvider],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
      <SectionHeader
        title="Alert"
        description="Select the notification channels you want to be informed."
      />
      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem className="sm:col-span-1 sm:self-baseline">
              <FormLabel>Provider</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(notificationProviderSchema.parse(value))
                }
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {notificationProvider.map((provider) => {
                    const isIncluded =
                      getProviderMetaData(provider).plans?.includes(plan);
                    return (
                      <SelectItem
                        key={provider}
                        value={provider}
                        className="capitalize"
                        disabled={!isIncluded}
                      >
                        {provider}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormDescription>
                What channel/provider to send a notification.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-1 sm:self-baseline">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Dev Team" {...field} />
              </FormControl>
              <FormDescription>Define a name for the channel.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {watchProvider && (
          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem className="sm:col-span-full">
                {/* make the first letter capital */}
                <div className="flex items-center justify-between">
                  <FormLabel>{toCapitalize(watchProvider)}</FormLabel>
                </div>
                <FormControl>
                  <Input
                    type={providerMetaData.dataType}
                    placeholder={providerMetaData.placeholder}
                    {...field}
                    disabled={!providerMetaData.plans?.includes(plan)}
                  />
                </FormControl>
                <FormDescription className="flex items-center justify-between">
                  The data required.
                  {providerMetaData.setupDocLink && (
                    <a
                      href={providerMetaData.setupDocLink}
                      target="_blank"
                      className="underline hover:no-underline"
                    >
                      How to setup your {toCapitalize(watchProvider)} webhook
                    </a>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
}
