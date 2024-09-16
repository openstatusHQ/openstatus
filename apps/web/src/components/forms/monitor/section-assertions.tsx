"use client";

import * as React from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import {
  numberCompareDictionary,
  stringCompareDictionary,
  textBodyAssertion,
} from "@openstatus/assertions";
import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  Button,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Icons } from "@/components/icons";
import { SectionHeader } from "../shared/section-header";

// IMPROVEMENT: use FormFields incl. error message (fixes the Select component)

export const setEmptyOrStr = (v: unknown) => {
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

// REMINDER: once we have different types of assertions based on different jobTypes
// we shoulds start creating a mapping function with allowed assertions for each jobType

export function SectionAssertions({ form }: Props) {
  const statusAssertions = useFieldArray({
    control: form.control,
    name: "statusAssertions",
  });
  const headerAssertions = useFieldArray({
    control: form.control,
    name: "headerAssertions",
  });
  const textBodyAssertions = useFieldArray({
    control: form.control,
    name: "textBodyAssertions",
  });

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Timing Setting"
        description={
          <>
            Add specific time limits to your requests to receive notifications
            if an endpoint takes longer than expected.
          </>
        }
      />
      <div className="grid w-full gap-4 sm:grid-cols-6">
        <FormField
          control={form.control}
          name="degradedAfter"
          render={({ field }) => (
            <FormItem className="col-span-6 sm:col-span-3">
              <FormLabel>
                Degraded <span className="font-normal">(in ms.)</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={60000}
                  placeholder="30000"
                  {...form.register(field.name, {
                    setValueAs: (v) => (v === "" ? null : v),
                  })}
                />
              </FormControl>
              <FormDescription>
                Time after which the endpoint is considered degraded.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timeout"
          render={({ field }) => (
            <FormItem className="col-span-6 sm:col-span-3">
              <FormLabel>
                Timeout <span className="font-normal">(in ms.)</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="45000"
                  min={0}
                  max={60000}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Max. time allowed for request to complete.
              </FormDescription>

              {/* <FormMessage /> */}
            </FormItem>
          )}
        />
      </div>
      <SectionHeader
        title="Assertions"
        description={
          <>
            Validate the response to ensure your service is working as expected.
            <br />
            <span className="underline decoration-border underline-offset-4">
              By default, we check for a{" "}
              <span className="font-medium text-foreground">
                <code>2xx</code> status code
              </span>
            </span>
            .
          </>
        }
      />
      {form.getValues("jobType") === "http" ? (
        <div className="flex flex-col gap-4">
          {statusAssertions.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-4">
              <p className="col-span-2 text-muted-foreground text-sm">
                Status Code
              </p>
              <div className="col-span-3" />
              <FormField
                control={form.control}
                name={`statusAssertions.${i}.compare`}
                render={({ field }) => (
                  <FormItem className="col-span-3 w-full">
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue defaultValue="eq" placeholder="Equal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(numberCompareDictionary).map(
                          ([key, value]) => (
                            <SelectItem key={key} value={key}>
                              {value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Input
                {...form.register(`statusAssertions.${i}.target`, {
                  required: true,
                  valueAsNumber: true,
                  validate: (value) =>
                    value <= 599 || "Value must be 599 or lower",
                })}
                type="number"
                placeholder="200"
                className="col-span-3"
              />
              <div className="col-span-1">
                <Button
                  size="icon"
                  onClick={() => statusAssertions.remove(i)}
                  variant="ghost"
                  type="button"
                >
                  <Icons.trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {headerAssertions.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-4">
              <p className="col-span-2 text-muted-foreground text-sm">
                Response Header
              </p>
              <Input
                {...form.register(`headerAssertions.${i}.key`, {
                  required: true,
                  setValueAs: setEmptyOrStr,
                })}
                className="col-span-3"
                placeholder="X-Header"
              />
              <FormField
                control={form.control}
                name={`headerAssertions.${i}.compare`}
                render={({ field }) => (
                  <FormItem className="col-span-3 w-full">
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue defaultValue="eq" placeholder="Equal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(stringCompareDictionary).map(
                          ([key, value]) => (
                            <SelectItem key={key} value={key}>
                              {value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Input
                {...form.register(`headerAssertions.${i}.target`)}
                className="col-span-3"
                placeholder="x-value"
              />
              <div className="col-span-1">
                <Button
                  size="icon"
                  onClick={() => headerAssertions.remove(i)}
                  variant="ghost"
                >
                  <Icons.trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {textBodyAssertions.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-4">
              <p className="col-span-2 text-muted-foreground text-sm">Body</p>
              <div className="col-span-3" />
              <FormField
                control={form.control}
                name={`textBodyAssertions.${i}.compare`}
                render={({ field }) => (
                  <FormItem className="col-span-3 w-full">
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue defaultValue="eq" placeholder="Equal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(stringCompareDictionary).map(
                          ([key, value]) => (
                            <SelectItem key={key} value={key}>
                              {value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <Input
                {...form.register(`textBodyAssertions.${i}.target`, {
                  required: true,
                })}
                placeholder="<html>...</html>"
                className="col-span-3"
              />
              <div className="col-span-1">
                <Button
                  size="icon"
                  onClick={() => textBodyAssertions.remove(i)}
                  variant="ghost"
                  type="button"
                >
                  <Icons.trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                statusAssertions.append({
                  version: "v1",
                  type: "status",
                  compare: "eq",
                  target: 200,
                })
              }
            >
              Add Status Code Assertion
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                headerAssertions.append({
                  version: "v1",
                  type: "header",
                  key: "Content-Type",
                  compare: "eq",
                  target: "application/json",
                })
              }
            >
              Add Header Assertion
            </Button>

            <Button
              variant="outline"
              type="button"
              onClick={() =>
                textBodyAssertions.append({
                  version: "v1",
                  type: "textBody",
                  compare: "eq",
                  target: "",
                })
              }
            >
              Add String Body Assertion
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="alert-triangle"
          title="No Assertions"
          description="Assertions are only available for HTTP monitors."
        />
      )}
    </div>
  );
}
