"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage } from "@openstatus/db/src/schema";
import {
  Button,
  Checkbox,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { CopyToClipboardButton } from "@/components/dashboard/copy-to-clipboard-button";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertPage>;
}

export function SectionVisibility({ form }: Props) {
  const watchPasswordProtected = form.watch("passwordProtected");
  const watchPassword = form.watch("password");

  const getBaseUrl = () => {
    if (process.env.NODE_ENV === "development") {
      return `http://localhost:3000/status-page/${form.getValues("slug")}`;
    }
    if (form.getValues("customDomain") !== "") {
      return `https://${form.getValues("customDomain")}`;
    }
    return `https://${form.getValues("slug")}.openstatus.dev`;
  };

  const link = `${getBaseUrl()}?authorize=${watchPassword}`;

  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <SectionHeader
        title="Visibility"
        description="Hide your page from the public by setting a password."
        className="md:col-span-full"
      />
      <FormField
        control={form.control}
        name="passwordProtected"
        render={({ field }) => (
          <FormItem className="sm:col-span-22 flex flex-row items-start space-x-3 space-y-0 md:col-span-full">
            <FormControl>
              <Checkbox
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>Protect with password</FormLabel>
              <FormDescription>Hide the page from the public</FormDescription>
            </div>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem className="md:col-span-1">
            <FormLabel>Password</FormLabel>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  placeholder="top-secret"
                  disabled={!watchPasswordProtected}
                  {...field}
                />
              </FormControl>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => form.setValue("password", "")}
                disabled={!field.value || !watchPasswordProtected}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <FormDescription>
              No restriction on the password. It&apos;s just a simple password
              you define.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {watchPasswordProtected ? (
        <div className="text-sm md:col-span-full">
          <p className="text-muted-foreground">
            If you want to share the page without the need to enter the
            password, you can share the following link:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-foreground">{link} </p>
            <CopyToClipboardButton
              text={link}
              tooltipText="Copy to clipboard"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
