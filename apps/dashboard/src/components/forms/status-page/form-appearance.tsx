import { useTransition } from "react";
import { z } from "zod";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { ThemePickerPopover } from "@/components/forms/status-page/theme-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ThemeKey } from "@openstatus/theme-store";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { isTRPCClientError } from "@trpc/client";
import { ArrowUpRight, Laptop, Moon, Sun } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const schema = z.object({
  forceTheme: z.enum(["light", "dark", "system"]),
  configuration: z.object({
    theme: z.string(),
  }),
});

type FormValues = z.infer<typeof schema>;

export function FormAppearance({
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
      forceTheme: "system",
    },
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
          <FormCardHeader>
            <FormCardTitle>Appearance</FormCardTitle>
            <FormCardDescription>
              Forced theme will override the user&apos;s preference.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="forceTheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" />
                          <span>Light</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          <span>Dark</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4" />
                          <span>System</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <FormDescription>
                    Override the user&apos;s preference.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="configuration.theme"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Style</FormLabel>
                  <ThemePickerPopover
                    value={field.value as ThemeKey}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                  <FormDescription>Choose a theme to apply.</FormDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Your user will still be able to change the mode via the theme
              toggle.
            </FormCardFooterInfo>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" asChild>
                <Link
                  href="https://themes.openstatus.dev"
                  rel="noreferrer"
                  target="_blank"
                >
                  View Theme Explorer <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
