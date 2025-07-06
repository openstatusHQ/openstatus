"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

const tagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});

const schema = z.object({
  tags: z.array(tagSchema),
});

export type FormValues = z.infer<typeof schema>;

// FIXME: rename, its not monitor specfic, its all the tags
export function FormMonitorTag({
  defaultValues,
  className,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const trpc = useTRPC();
  const { data: tags } = useQuery(trpc.monitorTag.list.queryOptions());

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      tags: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tags",
  });

  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving tags...",
          success: "Tags saved successfully",
          error: "Failed to save tags",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (!tags) return null;

  return (
    <Form {...form}>
      <form
        className={cn("grid gap-4", className)}
        onSubmit={(e) => {
          // NOTE: we use the form nested within another form, so we need to prevent the default behavior
          // and stop the propagation to avoid double submission
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit(submitAction)(e);
        }}
        {...props}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel>Tags</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ name: "", color: "#00008B" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-4 items-start">
              <FormField
                control={form.control}
                name={`tags.${index}.color`}
                render={({ field }) => (
                  <FormItem className="p-1">
                    <FormControl>
                      <Input
                        type="color"
                        className="size-7 p-0 rounded-full overflow-hidden"
                        style={{ backgroundColor: field.value }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`tags.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Tag name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </form>
    </Form>
  );
}
