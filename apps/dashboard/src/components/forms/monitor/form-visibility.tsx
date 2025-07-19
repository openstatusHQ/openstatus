"use client";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  visibility: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function FormVisibility({
  locked,
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  locked?: boolean;
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      visibility: false,
    },
  });
  const [isPending, startTransition] = useTransition();
  const { id } = useParams<{ id: string }>();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: "Failed to save",
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
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Visibility</FormCardTitle>
            <FormCardDescription>
              Share your monitor stats with the public.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="visibility"
              disabled={locked}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Allow public access</FormLabel>
                    <FormDescription>
                      Change monitor visibility. When checked, the monitor stats
                      from the overview page will be public. You will be able to
                      share it via a connected status page or{" "}
                      <Link
                        href={`https://openstatus.dev/public/monitors/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        https://openstatus.dev/public/monitors/{id}
                      </Link>
                      .
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={locked}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/status-page/advanced/monitors/"
                rel="noreferrer"
                target="_blank"
              >
                monitor visibility
              </Link>
              .
            </FormCardFooterInfo>
            {locked ? (
              <Button asChild>
                <NextLink href="/settings/billing">
                  <Lock className="size-4" />
                  Upgrade
                </NextLink>
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
