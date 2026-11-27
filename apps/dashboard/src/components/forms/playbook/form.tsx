"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  isBuiltinPlaybookSlug,
  PLAYBOOK_DESCRIPTION_MAX_CHARS,
  PLAYBOOK_SLUG,
  PLAYBOOK_SLUG_MAX_CHARS,
  PLAYBOOK_TITLE_MAX_CHARS,
} from "@openstatus/db/src/schema/playbooks/constants";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormCardContent } from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(PLAYBOOK_TITLE_MAX_CHARS),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(PLAYBOOK_SLUG_MAX_CHARS)
    .regex(PLAYBOOK_SLUG, "Use lowercase letters, digits and single hyphens"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(PLAYBOOK_DESCRIPTION_MAX_CHARS),
});

export type FormValues = z.infer<typeof schema>;

export function FormPlaybook({
  takenSlugs,
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  takenSlugs: string[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(
      schema.refine(
        (v) => !isBuiltinPlaybookSlug(v.slug) && !takenSlugs.includes(v.slug),
        { path: ["slug"], message: "This slug is already in use" },
      ),
    ),
    defaultValues: { title: "", slug: "", description: "" },
  });
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Creating...",
          success: () => "Playbook created",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to create";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Database failover" {...field} />
                </FormControl>
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
                  <Input
                    className="font-mono"
                    placeholder="database-failover"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  How the agent and the API address the playbook. It cannot be
                  changed later.
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
                  <Textarea
                    rows={3}
                    placeholder="How we fail over the primary database. Read before touching it."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  What the playbook covers. The agent reads this to decide when
                  to open it.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
