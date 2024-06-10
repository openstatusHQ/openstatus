"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { insertMaintenanceSchema } from "@openstatus/db/src/schema";
import type { InsertMaintenance, Monitor } from "@openstatus/db/src/schema";
import { Form } from "@openstatus/ui";

import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";

import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { SectionConnect } from "./section-connect";

interface Props {
  defaultSection?: string;
  defaultValues?: InsertMaintenance;
  monitors?: Monitor[];
  nextUrl?: string;
  pageId: number;
}

export function MaintenanceForm({
  defaultSection,
  defaultValues,
  monitors,
  nextUrl,
  pageId,
}: Props) {
  const form = useForm<InsertMaintenance>({
    resolver: zodResolver(insertMaintenanceSchema),
    defaultValues: {
      ...defaultValues,
      title: defaultValues?.title || "",
      message: defaultValues?.message || "",
      from: defaultValues?.from ? new Date(defaultValues.from) : new Date(),
      to: defaultValues?.to
        ? new Date(defaultValues.to)
        : new Date(Date.now() + 1000 * 60 * 60),
      pageId,
    },
  });
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const onSubmit = async ({ ...props }: InsertMaintenance) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.maintenance.update.mutate(props);
        } else {
          await api.maintenance.create.mutate(props);
        }
        toastAction("saved");
        // otherwise, the form will stay dirty - keepValues is used to keep the current values in the form
        form.reset({}, { keepValues: true });
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  };

  function onValueChange(value: string) {
    // REMINDER: we are not merging the searchParams here
    // we are just setting the section to allow refreshing the page
    const params = new URLSearchParams();
    params.set("section", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  console.log(form.formState.errors);

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <General form={form} />
        <Tabs
          defaultValue={defaultSection}
          className="w-full"
          onValueChange={onValueChange}
        >
          <TabsList>
            <TabsTrigger value="connect">Connect</TabsTrigger>
          </TabsList>
          <TabsContent value="connect">
            <SectionConnect form={form} monitors={monitors} />
          </TabsContent>
        </Tabs>
        <SaveButton
          isPending={isPending}
          isDirty={form.formState.isDirty}
          onSubmit={form.handleSubmit(onSubmit)}
        />
      </form>
    </Form>
  );
}
