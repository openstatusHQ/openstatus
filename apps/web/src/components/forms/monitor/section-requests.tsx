"use client";

import { Wand2, X } from "lucide-react";
import * as React from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import {
  monitorMethods,
  monitorMethodsSchema,
} from "@openstatus/db/src/schema";
import type { InsertMonitor, WorkspacePlan } from "@openstatus/db/src/schema";
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

import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

// TODO: add Dialog with response informations when pingEndpoint!

export function SectionRequests({ form }: Props) {
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

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="HTTP Request Settings"
        description="Create your HTTP. Add custom headers, payload and test your endpoint before submitting."
      />
      <div className="grid gap-4 sm:grid-cols-7">
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem className="sm:col-span-1">
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
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="sm:col-span-6">
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
                  {watchMethod === "POST" &&
                    fields.some(
                      (field) =>
                        field.key === "Content-Type" &&
                        field.value === "application/json"
                    ) && (
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
                    )}
                </div>
                <FormControl>
                  {/* FIXME: cannot enter 'Enter' */}
                  <Textarea
                    rows={8}
                    placeholder='{ "hello": "world" }'
                    {...field}
                  />
                </FormControl>
                <FormDescription>Write your payload payload.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
