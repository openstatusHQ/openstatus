"use client";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardContentUpgrade,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { Key, Lock, LockOpen, ShieldUser } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const protectionTypeSchema = z.enum(["none", "password", "magiclink"]);

const schema = z.object({
  protectionType: protectionTypeSchema.default("none"),
  passwordProtected: z.boolean().optional(), // TODO: replace with protectionType
  password: z.string().optional(),
  allowedDomains: z.preprocess(
    (val) => (val ? val.split(",").map((domain) => domain.trim()) : []),
    z.array(z.string()).optional(),
  ),
});

type FormValues = z.infer<typeof schema>;

export function FormPasswordProtection({
  lockedMap,
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  lockedMap?: Map<z.infer<typeof protectionTypeSchema>, boolean>;
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      protectionType: "none",
      passwordProtected: false,
      password: "",
      allowedDomains: [],
    },
  });
  const watchProtectionType = form.watch("protectionType");
  const locked = lockedMap?.get(watchProtectionType);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        console.log(values);
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
            <FormCardTitle>Protection</FormCardTitle>
            <FormCardDescription>
              Enable protection for your status page. Choose between simple
              password or email domain authentication via magic link.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="protectionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protection Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                      disabled={!!defaultValues?.type}
                    >
                      {[
                        { value: "none", icon: LockOpen, label: "Public" },
                        { value: "password", icon: Key, label: "Password" },
                        {
                          value: "magiclink",
                          icon: ShieldUser,
                          label: "Magic Link",
                        },
                      ].map((type) => {
                        return (
                          <FormItem
                            key={type.value}
                            className={cn(
                              "relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                            )}
                          >
                            <FormControl>
                              <RadioGroupItem
                                value={type.value}
                                className="sr-only"
                                disabled={!!defaultValues?.type}
                              />
                            </FormControl>
                            <type.icon
                              className="shrink-0 text-muted-foreground"
                              size={16}
                              aria-hidden="true"
                            />
                            <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                              {type.label}
                            </FormLabel>
                          </FormItem>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          {watchProtectionType && watchProtectionType !== "none" ? (
            <FormCardSeparator />
          ) : null}
          {watchProtectionType === "password" ? (
            <FormCardContent className="grid gap-4">
              {locked ? <FormCardContentUpgrade /> : null}
              <FormField
                control={form.control}
                name="password"
                disabled={locked}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Set a password to your status page to have a very basic
                      protection.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </FormCardContent>
          ) : null}
          {watchProtectionType === "magiclink" ? (
            <FormCardContent className="grid gap-4">
              {locked ? <FormCardContentUpgrade /> : null}
              <FormField
                control={form.control}
                name="allowedDomains"
                disabled={locked}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Domains</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Comma-separated list of email domains. Only emails from
                      these domains will be allowed to access the status page.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </FormCardContent>
          ) : null}
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/reference/status-page/#password"
                rel="noreferrer"
                target="_blank"
              >
                Protection
              </Link>
              .
            </FormCardFooterInfo>
            {locked ? (
              <Button type="button" asChild>
                <Link href="/settings/billing">
                  <Lock />
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
