"use client";

import { X } from "lucide-react";
import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { InsertPage, WorkspacePlan } from "@openstatus/db/src/schema";
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

import { getBaseUrl } from "@/app/status-page/[domain]/utils";
import { ProFeatureHoverCard } from "@/components/billing/pro-feature-hover-card";
import { CopyToClipboardButton } from "@/components/dashboard/copy-to-clipboard-button";
import { SectionHeader } from "../shared/section-header";

interface Props {
  form: UseFormReturn<InsertPage>;
  plan: WorkspacePlan;
  workspaceSlug: string;
}

export function SectionVisibility({ form, plan, workspaceSlug }: Props) {
  const watchPasswordProtected = form.watch("passwordProtected");
  const watchPassword = form.watch("password");

  const baseUrl = getBaseUrl({
    slug: form.getValues("slug"),
    customDomain: form.getValues("customDomain"),
  });
  const link = `${baseUrl}?authorize=${watchPassword}`;

  const hasFreePlan = plan === "free";

  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <SectionHeader
        title="Visibility"
        description="Hide your page from the public by setting a password."
        className="md:col-span-full"
      />
      <ProFeatureHoverCard
        workspaceSlug={workspaceSlug}
        plan={plan}
        minRequiredPlan="starter"
      >
        <div className="grid w-full gap-4 md:col-span-full md:grid-cols-2">
          <FormField
            control={form.control}
            name="passwordProtected"
            disabled={hasFreePlan}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 md:col-span-full">
                <FormControl>
                  <Checkbox
                    disabled={field.disabled}
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Protect with password</FormLabel>
                  <FormDescription>
                    Hide the page from the public
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            disabled={hasFreePlan}
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Password</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="top-secret"
                      disabled={!watchPasswordProtected}
                      value={field.value ?? ""} // REMINDER: remove nullish coalescing from db schema
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
                  No restriction on the password. It&apos;s just a simple
                  password you define.
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
                {/* TODO: think of building a better shadcn like "CopyToClipboardButton" */}
                <CopyToClipboardButton
                  text={link}
                  tooltipText="Copy to clipboard"
                />
              </div>
            </div>
          ) : null}
        </div>
      </ProFeatureHoverCard>
    </div>
  );
}
