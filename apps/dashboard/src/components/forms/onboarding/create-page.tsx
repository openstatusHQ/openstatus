"use client";

import { InputWithAddons } from "@/components/common/input-with-addons";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDebounce } from "@/hooks/use-debounce";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SLUG_UNIQUE_ERROR_MESSAGE =
  "This slug is already taken. Please choose another one.";

const schema = z.object({
  slug: z.string().min(3),
});

export type FormValues = z.infer<typeof schema>;

export function CreatePageForm({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const trpc = useTRPC();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { slug: "" },
  });
  const [isPending, startTransition] = useTransition();
  const watchSlug = form.watch("slug");
  const debouncedSlug = useDebounce(watchSlug, 500);
  const { data: isUnique } = useQuery(
    trpc.page.getSlugUniqueness.queryOptions(
      { slug: debouncedSlug },
      { enabled: debouncedSlug.length > 0 },
    ),
  );

  useEffect(() => {
    if (isUnique === false) {
      form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
    } else {
      form.clearErrors("slug");
    }
  }, [isUnique, form, debouncedSlug, defaultValues?.slug]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        if (isUnique === false) {
          toast.error(SLUG_UNIQUE_ERROR_MESSAGE);
          form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
          return;
        }

        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            console.error(error);
            return "Failed to save";
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
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <InputWithAddons
                  placeholder="status"
                  trailing=".openstatus.dev"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Choose a unique subdomain for your status page (minimum 3
                characters).
              </FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
