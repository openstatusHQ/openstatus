"use client";

import { Wand2, X } from "lucide-react";
import type * as React from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import {
  monitorMethods,
  monitorMethodsSchema,
} from "@openstatus/db/src/schema";
import type { InsertMonitor } from "@openstatus/db/src/schema";
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

import { set } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

// TODO: add Dialog with response informations when pingEndpoint!

export function SectionRequests({ form }: Props) {
  const { fields, append, prepend, remove, update } = useFieldArray({
    name: "headers",
    control: form.control,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const watchMethod = form.watch("method");

  const value = form.getValues("body") ? "payload" : undefined;
  const [file, setFile] = useState<string | undefined>(value);

  const defaultContentType = fields.find(
    (field) => field.key === "Content-Type"
  )?.value;
  const [content, setContent] = useState<string | undefined>(
    defaultContentType
  );
  useEffect(() => {
    if (
      watchMethod === "POST" &&
      !fields.some((field) => field.key === "Content-Type")
    ) {
      if (content && content !== "none") {
        prepend({ key: "Content-Type", value: content });
      }
      if (!content) {
        prepend({ key: "Content-Type", value: "application/json" });
        setContent("application/json");
      }
      return;
    }
    if (
      watchMethod === "POST" &&
      fields.find((field) => field.key === "Content-Type")?.value &&
      content === undefined
    ) {
      setContent(fields.find((field) => field.key === "Content-Type")?.value);
    }
  }, [watchMethod, prepend, fields, content]);

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

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const file = event.target.files[0];

      // File too big, return error
      const fileSize = file.size / 1024 / 1024; // in MiB
      if (fileSize > 10) {
        // Display error message
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === "string") {
          form.setValue("body", event.target?.result);
          setFile(file.name);
        }
      };

      reader.readAsDataURL(file);
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
                  setContent(undefined);
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
                <Input
                  className="bg-muted"
                  placeholder="https://documenso.com/api/health"
                  {...field}
                />
              </FormControl>
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
                onClick={() => {
                  remove(index);
                }}
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
                  <FormLabel className="flex items-center space-x-2">
                    Body
                    <Select
                      defaultValue={content}
                      onValueChange={(value: string) => {
                        if (content === "application/octet-stream") {
                          form.setValue("body", "");
                          setFile(undefined);
                        }

                        setContent(value);
                        if (value === "none") {
                          return;
                        }

                        const contentIndex = fields.findIndex(
                          (field) => field.key === "Content-Type"
                        );
                        if (contentIndex >= 0) {
                          update(contentIndex, { key: "Content-Type", value });
                        }
                      }}
                    >
                      <SelectTrigger
                        variant={"ghost"}
                        className="ml-1 h-7 text-muted-foreground text-xs"
                      >
                        {/* it's 💩 but my 🧠 is 🍤 */}
                        <SelectValue placeholder="JSON" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="application/octet-stream">
                          Binary File
                        </SelectItem>
                        <SelectItem value="application/json">JSON</SelectItem>
                        <SelectItem value="application/xml">XML</SelectItem>
                        <SelectItem value="application/yaml">YAML</SelectItem>
                        <SelectItem value="application/edn">EDN</SelectItem>
                        <SelectItem value="application/other">Other</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormLabel>
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
                              className="h-7 w-7"
                              onClick={onPrettifyJSON}
                            >
                              <Wand2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Prettify JSON</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                </div>
                <div className="space-y-2">
                  <FormControl>
                    {content === "application/octet-stream" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => inputRef.current?.click()}
                        >
                          {file ? <> {file}</> : <>Upload file</>}
                        </Button>

                        <input
                          type="file"
                          onChange={uploadFile}
                          ref={inputRef}
                          hidden
                        />
                      </>
                    ) : (
                      <>
                        {content === "none" ? undefined : (
                          <>
                            <Textarea
                              rows={8}
                              placeholder='{ "hello": "world" }'
                              {...field}
                            />
                            <FormDescription>
                              Write your payload.
                            </FormDescription>
                          </>
                        )}
                      </>
                    )}
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
