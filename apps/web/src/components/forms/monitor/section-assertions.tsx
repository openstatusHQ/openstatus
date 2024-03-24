"use client";

import * as React from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import { numberCompareDictionary } from "@openstatus/assertions";
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

interface Props {
  form: UseFormReturn<InsertMonitor>;
}

export function SectionAssertions({ form }: Props) {
  const statusAssertions = useFieldArray({
    control: form.control,
    name: "statusAssertions",
  });
  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Assertions"
        description="Validate the response to ensure your service is working as expected."
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="col-span-6 space-y-4 md:col-span-4">
          {statusAssertions.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-4">
              <p className="text-muted-foreground shrink-0 text-sm">
                Status code
              </p>
              <Select
                {...form.register(`statusAssertions.${i}.compare`, {
                  required: true,
                })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue defaultValue="eq" placeholder="Equal" />
                </SelectTrigger>
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
              <Input
                {...form.register(`statusAssertions.${i}.target`, {
                  required: true,
                  valueAsNumber: true,
                })}
                type="number"
              />
              <div>
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
        </div>
      </div>
    </div>
  );
}
