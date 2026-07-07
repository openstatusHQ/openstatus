import { zodResolver } from "@hookform/resolvers/zod";
import {
  generateCustomCssTemplate,
  THEMES,
  validateCustomCss,
} from "@openstatus/theme-store";
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
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { isTRPCClientError } from "@trpc/client";
import { Lock } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";

const schema = z.object({
  customCss: z.string().superRefine((value, ctx) => {
    const result = validateCustomCss(value);
    if (!result.valid) {
      for (const message of result.errors) {
        ctx.addIssue({ code: "custom", message });
      }
    }
  }),
});

type FormValues = z.infer<typeof schema>;

export function FormCustomCss({
  defaultValues,
  onSubmit,
  locked,
  themeKey,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  locked?: boolean;
  themeKey?: string;
}) {
  // placeholder lists every supported css var, pre-filled with the values of
  // the page's currently selected theme
  const placeholder = generateCustomCssTemplate(
    THEMES[themeKey ?? "default"] ?? THEMES.default,
  );
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { customCss: "" },
  });

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard>
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Custom CSS</FormCardTitle>
            <FormCardDescription>
              Extend the theme&apos;s CSS variables with your own values. Custom
              CSS takes precedence over the selected theme.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="customCss"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSS</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={placeholder}
                      className="min-h-60 font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Target the <code>:root</code> (light) and <code>.dark</code>{" "}
                    selectors to override the theme variables. Leave empty to
                    fall back to the theme.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Check out the supported CSS variables in the{" "}
              <Link
                href="https://themes.openstatus.dev"
                rel="noreferrer"
                target="_blank"
              >
                Theme Explorer
              </Link>
              .
            </FormCardFooterInfo>
            {locked ? (
              <Button type="button" asChild>
                <Link href="/settings/billing">
                  <Lock className="size-4" />
                  Upgrade
                </Link>
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            )}
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
