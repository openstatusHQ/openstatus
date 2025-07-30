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
import { useDebounce } from "@/hooks/use-debounce";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import Image from "next/image";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

/** Convert a File to a base64 string without the data: prefix */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is like "data:image/png;base64,XXXX" – we only need the part after the comma
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FormGeneral({
  disabled,
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      slug: "",
      icon: undefined,
      description: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const uploadMutation = useMutation(trpc.blob.upload.mutationOptions());
  const watchSlug = form.watch("slug");
  const watchTitle = form.watch("title");
  const watchIcon = form.watch("icon");
  const debouncedSlug = useDebounce(watchSlug, 500);
  const { data: isUnique } = useQuery(
    trpc.page.getSlugUniqueness.queryOptions(
      { slug: debouncedSlug },
      { enabled: debouncedSlug.length > 0 },
    ),
  );

  useEffect(() => {
    if (!defaultValues?.title) {
      const formattedSlug = formatSlug(watchTitle);
      form.setValue("slug", formattedSlug);
    }
  }, [form, defaultValues?.title, watchTitle]);

  useEffect(() => {
    if (isUnique === undefined) return;
    if (defaultValues?.slug === debouncedSlug) return;

    if (!isUnique) {
      form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
    } else {
      form.clearErrors("slug");
    }
  }, [isUnique, form, debouncedSlug, defaultValues?.slug]);

  function submitAction(values: FormValues) {
    if (isPending || disabled) return;

    startTransition(async () => {
      try {
        if (isUnique === false && defaultValues?.slug !== values.slug) {
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
                    <div className="flex items-center space-x-2">
                      {watchIcon ? (
                        <>
                          <div className="size-[36px] overflow-hidden rounded-md border bg-muted">
                            <Image
                              src={field.value}
                              width={36}
                              height={36}
                              alt="Icon preview"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => form.setValue("icon", undefined)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Input
                          type="file"
                          accept="image/png,image/x-icon"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const base64String = await fileToBase64(file);
                            try {
                              const blob = await uploadMutation.mutateAsync({
                                filename: file.name,
                                file: base64String,
                              });
                              if (blob?.url) {
                                form.setValue("icon", blob.url as string);
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error("Upload failed");
                            }
                          }}
                        />
                      )}
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
            <Button type="submit" disabled={isPending || disabled}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
