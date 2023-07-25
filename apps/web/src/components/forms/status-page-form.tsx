"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import type { allMonitorsSchema } from "@openstatus/db/src/schema";
import { insertPageSchemaWithMonitors } from "@openstatus/db/src/schema";

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
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/trpc/client";
import { Checkbox } from "../ui/checkbox";
import { useToast } from "../ui/use-toast";

// REMINDER: only use the props you need!

type Schema = z.infer<typeof insertPageSchemaWithMonitors>;

interface Props {
  id: string;
  defaultValues?: Schema;
  onSubmit: (values: Schema) => Promise<void>;
  allMonitors?: z.infer<typeof allMonitorsSchema>;
}

export function StatusPageForm({
  id,
  defaultValues,
  onSubmit,
  allMonitors,
}: Props) {
  const form = useForm<Schema>({
    resolver: zodResolver(insertPageSchemaWithMonitors),
    defaultValues: {
      title: defaultValues?.title || "",
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
      workspaceId: defaultValues?.workspaceId || 0,
      id: defaultValues?.id || 0,
      monitors: defaultValues?.monitors ?? [],
      workspaceSlug: "",
    },
  });
  const watchSlug = form.watch("slug");
  const debouncedSlug = useDebounce(watchSlug, 1000); // using debounce to not exhaust the server
  const { toast } = useToast();

  const checkUniqueSlug = React.useCallback(async () => {
    const isUnique = await api.page.getSlugUniqueness.query({
      slug: debouncedSlug,
    });
    return isUnique || debouncedSlug === defaultValues?.slug;
  }, [debouncedSlug, defaultValues?.slug]);

  React.useEffect(() => {
    async function watchSlugChanges() {
      const isUnique = await checkUniqueSlug();
      if (!isUnique) {
        form.setError("slug", {
          message: "Already taken. Please select another slug.",
        });
      } else {
        form.clearErrors("slug");
      }
    }
    watchSlugChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkUniqueSlug]);

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const isUnique = await checkUniqueSlug();
          if (!isUnique) {
            // the user will already have the "error" message - we include a toast as well
            toast({
              title: "Slug is already taken.",
              description: "Please select another slug. Every slug is unique.",
            });
          } else {
            form.handleSubmit(onSubmit, (e) => {
              console.log(e);
            })(e);
          }
        }}
        id={id}
      >
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
                <FormDescription>The title of your page.</FormDescription>
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
                  The subdomain slug for your status page. At least 3 chars.
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
          <FormField
            control={form.control}
            name="monitors"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Monitor</FormLabel>
                  <FormDescription>
                    Select the monitors you want to display.
                  </FormDescription>
                </div>
                {allMonitors?.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="monitors"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([
                                      ...(field.value || []),
                                      item.id,
                                    ])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id,
                                      ),
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {item.name}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
