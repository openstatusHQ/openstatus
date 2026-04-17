"use client";

// FIXME: use input-group instead
import { InputWithAddons } from "@/components/common/input-with-addons";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
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
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Plus, X } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SLUG_UNIQUE_ERROR_MESSAGE =
  "This slug is already taken. Please choose another one.";

const schema = z.object({
  slug: z.string().min(3),
  components: z
    .array(
      z.object({
        name: z.string().min(1, "Component name is required"),
      }),
    )
    .optional(),
});

export type FormValues = z.infer<typeof schema>;

export function CreatePageForm({
  defaultValues,
  onSubmit,
  showComponents = false,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  showComponents?: boolean;
}) {
  const trpc = useTRPC();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: "",
      components: showComponents ? [{ name: "Website" }] : undefined,
      ...defaultValues,
    },
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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  });

  useEffect(() => {
    if (isUnique === false) {
      form.setError("slug", { message: SLUG_UNIQUE_ERROR_MESSAGE });
    } else {
      form.clearErrors("slug");
    }
  }, [isUnique, form]);

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
      <form
        onSubmit={form.handleSubmit(submitAction)}
        className="space-y-4"
        {...props}
      >
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
        {showComponents && (
          <div className="space-y-3">
            <FormLabel>Components</FormLabel>
            <FormDescription>
              Add the services your users care about. You can attach monitors
              later.
            </FormDescription>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`components.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input placeholder="e.g. API, Dashboard" {...field} />
                        </FormControl>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => remove(index)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            {fields.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "" })}
              >
                <Plus className="mr-1 size-4" />
                Add another
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  );
}
