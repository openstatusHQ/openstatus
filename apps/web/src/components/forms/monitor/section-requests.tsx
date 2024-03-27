"use client";

import * as React from "react";
import { Wand2, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import {
  monitorMethods,
  monitorMethodsSchema,
} from "@openstatus/db/src/schema";
import type {
  InsertMonitor,
  MonitorFlyRegion,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import {
  Button,
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
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import type { RegionChecker } from "@/app/play/checker/[id]/utils";
import { SectionHeader } from "../shared/section-header";
import { RequestTestButton } from "./request-test-button";

interface Props {
  form: UseFormReturn<InsertMonitor>;
  plan: WorkspacePlan;
  pingEndpoint(
    region?: MonitorFlyRegion,
  ): Promise<{ data: RegionChecker; error?: string }>;
}

// TODO: add Dialog with response informations when pingEndpoint!

export function SectionRequests({ form, pingEndpoint }: Props) {
  const { fields, append, remove } = useFieldArray({
    name: "headers",
    control: form.control,
  });
  const watchMethod = form.watch("method");

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

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="HTTP Request Settings"
        description="Create your HTTP. Add custom headers, payload and test your endpoint before submitting."
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Method</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(monitorMethodsSchema.parse(value));
                  form.resetField("body", { defaultValue: "" });
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="sm:w-[120px]">
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
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>URL</FormLabel>
              <FormControl>
                {/* <InputWithAddons
                  leading="https://"
                  placeholder="documenso.com/api/health"
                  {...field}
                /> */}
                <Input
                  className="bg-muted"
                  placeholder="https://documenso.com/api/health"
                  {...field}
                />
              </FormControl>
              {/* <FormMessage /> */}
            </FormItem>
          )}
        />
        <RequestTestButton {...{ form, pingEndpoint }} />
      </div>
      <div className="space-y-2 sm:col-span-full">
        <FormLabel>Request Header</FormLabel>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-6 gap-4">
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
                  Write your json payload. We automatically append{" "}
                  <code>"Content-Type": "application/json"</code> to the request
                  header.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
