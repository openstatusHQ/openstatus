"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";

import { insertPageSchema } from "@openstatus/db/src/schema";
import type { InsertPage } from "@openstatus/db/src/schema";
import {
  Badge,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { useDebounce } from "@/hooks/use-debounce";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import * as randomWordSlugs from "random-word-slugs";

interface StatusPageFormProps {
  defaultValues?: Partial<InsertPage>;
  toStep: number;
}

export function StatusPageForm({ defaultValues, toStep }: StatusPageFormProps) {
  const form = useForm<InsertPage>({
    resolver: zodResolver(insertPageSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
      workspaceId: defaultValues?.workspaceId || 0,
      id: defaultValues?.id || 0,
      customDomain: defaultValues?.customDomain || "",
      icon: defaultValues?.icon || "",
      password: defaultValues?.password || "",
      passwordProtected: defaultValues?.passwordProtected || false,
      showMonitorValues: defaultValues?.showMonitorValues || true,
      monitors: defaultValues?.monitors ?? [],
    },
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const watchSlug = form.watch("slug");
  const debouncedSlug = useDebounce(watchSlug, 1000); // using debounce to not exhaust the server

  const checkUniqueSlug = useCallback(async () => {
    const isUnique = await api.page.getSlugUniqueness.query({
      slug: debouncedSlug,
    });
    return isUnique;
  }, [debouncedSlug]);

  useEffect(() => {
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

    void watchSlugChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkUniqueSlug, form.clearErrors, form.setError]);

  const onSubmit = async ({ ...props }: InsertPage) => {
    startTransition(async () => {
      try {
        const isUnique = await checkUniqueSlug();
        if (!isUnique) {
          // the user will already have the "error" message - we include a toast as well
          toastAction("unique-slug");
        } else {
          await api.page.create.mutate({
            ...props,
            title: `${props.slug.replace("-", " ")} status`,
          });

          toast.success("Saved successfully.", {
            description: "Your status page is ready to go.",
            action: {
              label: "Visit",
              onClick: () =>
                window.open(`https://${props.slug}.openstatus.dev`, "_blank")
                  ?.location,
            },
          });
          // otherwise, the form will stay dirty - keepValues is used to keep the current values in the form
          form.reset({}, { keepValues: true });
          router.replace(`?step=${toStep}`);
          router.refresh();
        }
      } catch {
        toastAction("error");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input placeholder="documenso" {...field} />
              </FormControl>
              <FormDescription>
                Enter the slug for your status page or generate one:{" "}
                <Button
                  type="button"
                  onClick={() => {
                    field.onChange(randomWordSlugs.generateSlug(2));
                  }}
                  className="px-2 h-7"
                  variant="outline"
                  size="sm"
                >
                  random slug
                </Button>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <Button
            className="w-full sm:w-auto"
            size="lg"
            type="submit"
            disabled={isPending}
          >
            {!isPending ? "Create Status Page" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
