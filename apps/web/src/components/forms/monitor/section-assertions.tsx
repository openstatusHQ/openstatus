"use client";

import * as React from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import {
  numberCompareDictionary,
  stringCompareDictionary,
} from "@openstatus/assertions";
import type { InsertMonitor } from "@openstatus/db/src/schema";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { SectionHeader } from "../shared/section-header";

// IMPROVEMENT: use FormFields incl. error message

export const setEmptyOrStr = (v: unknown) => {
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

export function SectionAssertions({ form }: Props) {
  const statusAssertions = useFieldArray({
    control: form.control,
    name: "statusAssertions",
  });
  const headerAssertions = useFieldArray({
    control: form.control,
    name: "headerAssertions",
  });
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Assertions"
        description={
          <>
            Validate the response to ensure your service is working as expected.
            <br />
            <span className="decoration-border underline underline-offset-4">
              By default, we check for a{" "}
              <span className="text-foreground font-medium">
                <code>2xx</code> status code
              </span>
            </span>
            .
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {statusAssertions.fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 items-center gap-4">
            <p className="text-muted-foreground col-span-2 text-sm">
              Status Code
            </p>
            <div className="col-span-3" />
            <Select
              {...form.register(`statusAssertions.${i}.compare`, {
                required: true,
              })}
            >
              <SelectTrigger className="col-span-3 w-full">
                <SelectValue defaultValue="eq" placeholder="Equal" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(numberCompareDictionary).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              {...form.register(`statusAssertions.${i}.target`, {
                required: true,
                valueAsNumber: true,
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
            <p className="text-muted-foreground col-span-2 text-sm">
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

            <Select
              {...form.register(`headerAssertions.${i}.compare`, {
                required: true,
              })}
            >
              <SelectTrigger className="col-span-3 w-full">
                <SelectValue defaultValue="eq" placeholder="Equal" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(stringCompareDictionary).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              {...form.register(`headerAssertions.${i}.target`, {
                required: true,
                setValueAs: setEmptyOrStr,
              })}
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
        <div className="flex gap-4">
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
        </div>
      </div>
    </div>
  );
}
