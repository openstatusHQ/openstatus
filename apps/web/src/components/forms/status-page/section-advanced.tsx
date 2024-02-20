"use client";

import * as React from "react";
import { useRef } from "react";
import Image from "next/image";
import type { PutBlobResult } from "@vercel/blob";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage } from "@openstatus/db/src/schema";
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

import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertPage>;
}

export function SectionAdvanced({ form }: Props) {
  const inputFileRef = useRef<HTMLInputElement>(null);

  const handleChange = async (file: FileList | null) => {
    if (!file || file.length === 0) {
      return;
    }

    const response = await fetch(`/api/upload?filename=${file[0].name}`, {
      method: "POST",
      body: file[0],
    });

    const newblob = (await response.json()) as PutBlobResult;
    form.setValue("icon", newblob.url);
  };

  return (
    <div className="grid w-full gap-4">
      <SectionHeader
        title="Advanced Settings"
        description="Provide informations about what your status page is for. A favicon can be uploaded to customize your status page. It will be used as an icon on the header as well."
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="sm:col-span-full">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input
                placeholder="Stay informed about our api and website health."
                {...field}
              />
            </FormControl>
            <FormDescription>
              Provide your users informations about it.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="icon"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Favicon</FormLabel>
            <FormControl>
              <>
                {!field.value && (
                  <Input
                    type="file"
                    accept="image/x-icon,image/png"
                    ref={inputFileRef}
                    onChange={(e) => handleChange(e.target.files)}
                  />
                )}
                {field.value && (
                  <div className="flex items-center">
                    <div className="border-border h-10 w-10 rounded-sm border p-1">
                      <Image
                        src={field.value}
                        width={64}
                        height={64}
                        alt="Favicon"
                      />
                    </div>
                    <Button
                      variant="link"
                      onClick={() => {
                        form.setValue("icon", "");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </>
            </FormControl>
            <FormDescription>Your status page favicon</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
