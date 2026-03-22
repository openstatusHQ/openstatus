import { useTransition } from "react";
import { z } from "zod";

import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { isTRPCClientError } from "@trpc/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { type Locale, localeDetails, locales } from "@openstatus/locales";

const AVAILABLE_LOCALES = locales.map((code) => ({
  value: code,
  label: localeDetails[code].name,
}));

const schema = z
  .object({
    defaultLocale: z.enum(locales),
    locales: z.array(z.enum(locales)).nullable(),
  })
  .refine(
    (data) => {
      if (data.locales) {
        return data.locales.includes(data.defaultLocale);
      }
      return true;
    },
    {
      message: "Default locale must be included in the enabled locales",
      path: ["defaultLocale"],
    },
  );

type FormValues = z.infer<typeof schema>;

export function FormLocale({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      defaultLocale: "en",
      locales: null,
    },
  });

  const selectedLocales = form.watch("locales");
  const isMultiLocaleEnabled = selectedLocales !== null;

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
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

  function toggleMultiLocale(enabled: boolean) {
    if (enabled) {
      const currentDefault = form.getValues("defaultLocale");
      form.setValue("locales", [currentDefault], { shouldValidate: true });
    } else {
      form.setValue("locales", null, { shouldValidate: true });
    }
  }

  function toggleLocale(locale: Locale, checked: boolean) {
    const current = form.getValues("locales") ?? [];
    const updated = checked
      ? [...current, locale]
      : current.filter((l) => l !== locale);

    // Don't allow removing all locales
    if (updated.length === 0) return;

    form.setValue("locales", updated, { shouldValidate: true });

    // If the default locale was removed, switch to the first remaining locale
    const currentDefault = form.getValues("defaultLocale");
    if (!updated.includes(currentDefault)) {
      form.setValue("defaultLocale", updated[0], { shouldValidate: true });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Locales</FormCardTitle>
            <FormCardDescription>
              Configure which languages are available on your status page.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="defaultLocale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Locale</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select default locale" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AVAILABLE_LOCALES.map((locale) => (
                        <SelectItem key={locale.value} value={locale.value}>
                          {locale.label} ({locale.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The fallback language for your status page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multi-locale"
                  checked={isMultiLocaleEnabled}
                  onCheckedChange={(checked) =>
                    toggleMultiLocale(checked === true)
                  }
                />
                <label
                  htmlFor="multi-locale"
                  className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable locale switcher
                </label>
              </div>
              {isMultiLocaleEnabled ? (
                <div className="ml-6 space-y-2">
                  {AVAILABLE_LOCALES.map((locale) => (
                    <div
                      key={locale.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`locale-${locale.value}`}
                        checked={selectedLocales?.includes(locale.value)}
                        onCheckedChange={(checked) =>
                          toggleLocale(locale.value, checked === true)
                        }
                      />
                      <label
                        htmlFor={`locale-${locale.value}`}
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {locale.label} ({locale.value})
                      </label>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              When the locale switcher is enabled, visitors can choose their
              preferred language.
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
