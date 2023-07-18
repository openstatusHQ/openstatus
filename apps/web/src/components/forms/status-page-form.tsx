"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import { insertPageSchema } from "@openstatus/db/src/schema";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type Schema = z.infer<typeof insertPageSchema>;

interface Props {
  id: string;
  defaultValues?: Schema;
  onSubmit: (values: Schema) => Promise<void>;
}

export function StatusPageForm({ id, defaultValues, onSubmit }: Props) {
  const form = useForm<Schema>({
    resolver: zodResolver(insertPageSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id={id}>
        <div className="grid w-full items-center  space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>This is title of your page.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>
                  This is your url of your page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription>
                  Give your user some information about it.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
