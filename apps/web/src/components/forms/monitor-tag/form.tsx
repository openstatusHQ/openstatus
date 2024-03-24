"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import { insertMonitorTagSchema } from "@openstatus/db/src/schema";
import type { InsertMonitorTag, MonitorTag } from "@openstatus/db/src/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import { SaveButton } from "../shared/save-button";

interface Props {
  defaultValues?: MonitorTag;
}

export function MonitorTagForm({ defaultValues }: Props) {
  const form = useForm<InsertMonitorTag>({
    resolver: zodResolver(insertMonitorTagSchema),
    defaultValues,
  });
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onSubmit = ({ ...props }: InsertMonitorTag) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.monitorTag.update.mutate({ ...props });
        } else {
          await api.monitorTag.create.mutate({ ...props });
        }
        router.refresh();
        toastAction("saved");
      } catch {
        toastAction("error");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <div className="flex gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="API" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem className="w-12">
                <FormLabel>Color</FormLabel>
                <FormControl>
                  <Input type="color" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <SaveButton
          isPending={isPending}
          isDirty={form.formState.isDirty}
          onSubmit={form.handleSubmit(onSubmit)}
        />
      </form>
    </Form>
  );
}
