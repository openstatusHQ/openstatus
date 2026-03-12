"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormMessage } from "@openstatus/ui/components/ui/form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { isTRPCClientError } from "@trpc/client";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export type FormValues = z.infer<typeof schema>;

export function FormEmail({
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const t = useExtracted();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: t("Confirming..."),
          success: t("Confirmed"),
          error: (error) => {
            console.error(error);
            if (isTRPCClientError(error)) {
              form.setError("email", { message: error.message });
              return error.message;
            }
            if (error instanceof Error) {
              form.setError("email", { message: error.message });
              return error.message;
            }
            return t("Failed to confirm");
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
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("Email")}</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
