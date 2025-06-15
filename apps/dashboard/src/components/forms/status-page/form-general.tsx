"use client";

import { InputWithAddons } from "@/components/common/input-with-addons";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isTRPCClientError } from "@trpc/client";
import { useTRPC } from "@/lib/trpc/client";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";

const SLUG_UNIQUE_ERROR_MESSAGE =
  "This slug is already taken. Please choose another one.";

function formatSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(3, "Slug is required"),
  icon: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function FormGeneral({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      slug: "",
      icon: "",
      description: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const watchSlug = form.watch("slug");
  const watchTitle = form.watch("title");
  const debouncedSlug = useDebounce(watchSlug, 500);
  const { data: isUnique } = useQuery(
    trpc.page.getSlugUniqueness.queryOptions(
      { slug: debouncedSlug },
      { enabled: debouncedSlug.length > 0 }
    )
  );

  useEffect(() => {
    if (!defaultValues?.title) {
      const formattedSlug = formatSlug(watchTitle);
      form.setValue("slug", formattedSlug);
    }
  }, [form, defaultValues?.title, watchTitle]);

  useEffect(() => {
    if (isUnique === undefined) return;

    if (!isUnique) {
      form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
    } else {
      form.clearErrors("slug");
    }
  }, [isUnique, form, debouncedSlug]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        if (!isUnique) {
          toast.error(SLUG_UNIQUE_ERROR_MESSAGE);
          form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
          return;
        }

        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
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
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>General</FormCardTitle>
            <FormCardDescription>
              Configure the essential details for your status page.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="My Status Page" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Enter a descriptive name for your status page.
                  </FormDescription>
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
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <div className="flex flex-row items-center space-x-2">
                      <div className="size-[36px] rounded-md border bg-muted" />
                      <Input type="file" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Select an icon for your status page. Ideally sized
                    512x512px.
                  </FormDescription>
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
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Provide a brief overview of your status page purpose.
                  </FormDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <Button type="submit">Submit</Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
