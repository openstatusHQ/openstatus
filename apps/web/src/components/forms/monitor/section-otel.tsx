"use client";

import { X } from "lucide-react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";

import type { InsertMonitor } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

import {
  Button,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  limits: Limits;
}

export function SectionOtel({ form, limits }: Props) {
  const { fields, append, prepend, remove, update } = useFieldArray({
    name: "otelHeaders",
    control: form.control,
  });

  if (!limits.otel) {
    return <ProFeatureAlert feature="OpenTelemetry" workspacePlan="team" />;
  }

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="OpenTelemetry"
        description="Configure your OpenTelemetry Exporter."
      />
      <div className="grid sm:grid-cols-2 md:grid-cols-3">
        <FormField
          control={form.control}
          name="otelEndpoint"
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Endpoint</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="https://otel.openstatus.dev/api/v1/metrics"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                The endpoint to send the metrics to.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="space-y-2 sm:col-span-full">
        <FormLabel>Request Header</FormLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-6 gap-4">
            <FormField
              control={form.control}
              name={`otelHeaders.${index}.key`}
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
                name={`otelHeaders.${index}.value`}
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
                onClick={() => remove(index)}
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
    </div>
  );
}
