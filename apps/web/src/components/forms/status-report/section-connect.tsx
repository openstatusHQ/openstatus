"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  InsertStatusReport,
  Monitor,
  Page,
} from "@openstatus/db/src/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui";

import { CheckboxLabel } from "../shared/checkbox-label";

interface Props {
  form: UseFormReturn<InsertStatusReport>;
  pages?: Page[];
  monitors?: Monitor[];
}

export function SectionConnect({ form, pages, monitors }: Props) {
  return (
    <div className="grid w-full gap-4">
      <div className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="pages"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Pages</FormLabel>
                <FormDescription>
                  Select the pages that you want to refer the incident to.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 md:grid-cols-3 sm:grid-cols-2">
                {pages?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="pages"
                    render={({ field }) => {
                      return (
                        <FormItem key={item.id} className="h-full w-full">
                          <FormControl className="w-full">
                            <CheckboxLabel
                              id={String(item.id)}
                              name="page"
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                console.log(field, item.id, checked);
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id
                                      )
                                    );
                              }}
                            >
                              {item.title}
                            </CheckboxLabel>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              {!pages || pages.length === 0 ? (
                <FormDescription>Missing status pages.</FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monitors"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Monitors</FormLabel>
                {/* TODO: second phrase can be set inside of a (?) tooltip */}
                <FormDescription>
                  Select the monitors that you want to refer the incident to. It
                  will be displayed on the status page they are attached to.
                </FormDescription>
              </div>
              <div className="grid grid-cols-1 grid-rows-1 gap-6 md:grid-cols-3 sm:grid-cols-2">
                {monitors?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="monitors"
                    render={({ field }) => {
                      return (
                        <FormItem key={item.id} className="h-full w-full">
                          <FormControl className="w-full">
                            <CheckboxLabel
                              id={String(item.id)}
                              name="monitor"
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                console.log(field, item.id, checked);
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id
                                      )
                                    );
                              }}
                            >
                              {item.name}
                            </CheckboxLabel>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              {!monitors || monitors.length === 0 ? (
                <FormDescription>Missing monitors.</FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
