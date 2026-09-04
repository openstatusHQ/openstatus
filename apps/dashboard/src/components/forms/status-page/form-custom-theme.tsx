import { zodResolver } from "@hookform/resolvers/zod";
import { Collapse, Expand, Lock } from "@openstatus/icons";
import {
  type CustomTheme,
  formatThemeVars,
  generateThemeVarsTemplate,
  parseThemeVarsText,
  THEMES,
  type ThemeMode,
} from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { useState, useTransition } from "react";
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

const MODES = ["light", "dark"] as const;

const modeText = z.string().superRefine((value, ctx) => {
  for (const message of parseThemeVarsText(value).errors) {
    ctx.addIssue({ code: "custom", message });
  }
});

const schema = z.object({ light: modeText, dark: modeText });

type FormValues = z.infer<typeof schema>;

export function FormCustomTheme({
  defaultValue,
  onSubmit,
  locked,
  themeKey,
}: {
  defaultValue?: CustomTheme | null;
  onSubmit: (values: { customTheme: CustomTheme }) => Promise<void>;
  locked?: boolean;
  themeKey?: string;
}) {
  const theme = THEMES[themeKey ?? "default"] ?? THEMES.default;
  const [mode, setMode] = useState<ThemeMode>("light");
  const [extended, setExtended] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      light: formatThemeVars(defaultValue?.light),
      dark: formatThemeVars(defaultValue?.dark),
    },
  });

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit({
          customTheme: {
            light: parseThemeVarsText(values.light).vars,
            dark: parseThemeVarsText(values.dark).vars,
          },
        });
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
      <form
        onSubmit={form.handleSubmit(submitAction, (errors) => {
          // jump to the first tab with a validation error
          const errored = MODES.find((m) => errors[m]);
          if (errored) setMode(errored);
        })}
      >
        <FormCard>
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Custom Theme</FormCardTitle>
            <FormCardDescription>
              Override the selected theme&apos;s CSS variables with your own
              values for light and dark mode.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="light">Light</TabsTrigger>
                  <TabsTrigger value="dark">Dark</TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExtended((v) => !v)}
                >
                  {extended ? (
                    <Collapse className="size-4" />
                  ) : (
                    <Expand className="size-4" />
                  )}
                  {extended ? "Collapse" : "Extend"}
                </Button>
              </div>
              {MODES.map((m) => (
                <TabsContent key={m} value={m}>
                  <FormField
                    control={form.control}
                    name={m}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder={generateThemeVarsTemplate(theme, m)}
                            className={cn(
                              // no ligatures — Geist Mono merges "--" into a
                              // single long-dash glyph
                              "min-h-60 font-mono text-sm [font-variant-ligatures:none]",
                              // fixed sizing while collapsed — sizing the empty
                              // textarea from the placeholder (field-sizing:
                              // content) misplaces the caret
                              !extended && "field-sizing-fixed h-60",
                            )}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          One declaration per line, e.g.{" "}
                          <code className="[font-variant-ligatures:none]">
                            --primary: oklch(0.6 0.1 250);
                          </code>
                          . Leave empty to fall back to the theme.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Check out the supported CSS variables in the{" "}
              <Link
                href="https://www.openstatus.dev/docs/reference/status-page#custom-theme"
                rel="noreferrer"
                target="_blank"
              >
                Status Page Reference
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
