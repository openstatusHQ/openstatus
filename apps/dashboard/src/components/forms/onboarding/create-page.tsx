"use client";

// FIXME: use input-group instead
import { InputWithAddons } from "@/components/common/input-with-addons";
import { ThemePickerPopover } from "@/components/forms/status-page/theme-picker";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { THEME_KEYS, type ThemeKey } from "@openstatus/theme-store";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Laptop, Moon, Plus, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const SLUG_UNIQUE_ERROR_MESSAGE =
  "This slug is already taken. Please choose another one.";

// Keep in sync with `slugSchema` in
// `packages/db/src/schema/pages/validation.ts`. We can't import that on the
// client because `@openstatus/db` is server-only. Slugs are stored lowercase
// (subdomains are case-insensitive), so we restrict input client-side too.
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_PATTERN_MESSAGE =
  "Only use digits (0-9), hyphen (-) or lowercase characters (a-z).";

const FORCE_THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

const schema = z.object({
  slug: z.string().min(3).regex(SLUG_PATTERN, SLUG_PATTERN_MESSAGE),
  theme: z.enum(THEME_KEYS as [ThemeKey, ...ThemeKey[]]),
  forceTheme: z.enum(["light", "dark", "system"]),
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
  onValuesChange,
  showComponents = false,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  /** Mirror live form values to a parent that needs them (e.g. a preview). */
  onValuesChange?: (values: FormValues) => void;
  showComponents?: boolean;
}) {
  const trpc = useTRPC();
  const { theme: dashboardTheme, setTheme: setDashboardTheme } = useTheme();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: "",
      theme: "default-rounded",
      forceTheme:
        dashboardTheme === "dark" || dashboardTheme === "light"
          ? dashboardTheme
          : "system",
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

  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(form.getValues());
    const sub = form.watch((values) => {
      onValuesChange(values as FormValues);
    });
    return () => sub.unsubscribe();
  }, [form, onValuesChange]);

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="theme"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>Style</FormLabel>
                <ThemePickerPopover
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="forceTheme"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>Mode</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Mirror to the dashboard so the user previews exactly
                    // what they'll publish. The whole shell flips with them.
                    setDashboardTheme(v);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FORCE_THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="size-4" />
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
