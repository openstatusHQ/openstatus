"use client";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
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
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Shuffle } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens",
    ),
});

type FormValues = z.infer<typeof schema>;

export function FormWorkspaceCreate({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const { data: initialSlug, refetch } = useQuery(
    trpc.workspace.generateSlug.queryOptions(),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      slug: "",
    },
  });

  useEffect(() => {
    if (initialSlug) {
      form.setValue("slug", initialSlug.slug);
    }
  }, [initialSlug, form]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Creating workspace...",
          success: "Workspace created!",
          error: (error) => {
            if (isTRPCClientError(error)) {
              if (error.message.includes("Workspace slug already exists")) {
                form.setError("slug", { message: error.message });
              }
              return error.message;
            }
            return "Failed to create workspace";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  async function handleGenerateSlug() {
    try {
      const result = await refetch();
      if (result.data) {
        form.setValue("slug", result.data.slug);
      }
    } catch (_error) {
      toast.error("Failed to generate slug");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Create Workspace</FormCardTitle>
            <FormCardDescription>
              Set up your workspace to start monitoring your services.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Company"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    A friendly name for your workspace.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Slug</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="my-company"
                        {...field}
                        disabled={isPending}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateSlug}
                        disabled={isPending}
                        title="Generate random slug"
                      >
                        <Shuffle className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    A unique identifier for your workspace. Generated randomly.
                  </FormDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Workspace"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
