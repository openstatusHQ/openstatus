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
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const schema = z.object({
  homepageUrl: z.string().optional(),
  contactUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function FormLinks({
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
      homepageUrl: "",
      contactUrl: "",
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
            <FormCardTitle>Links</FormCardTitle>
            <FormCardDescription>
              Configure the links for the status page.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="homepageUrl"
              render={({ field }) => (
                <FormItem className="sm:col-span-full">
                  <FormLabel>Homepage URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    What URL should the logo link to? Leave empty to hide.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactUrl"
              render={({ field }) => (
                <FormItem className="sm:col-span-full">
                  <FormLabel>Contact URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://acme.com/contact" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Enter the URL for your contact page. Or start with{" "}
                    <code className="rounded-md bg-muted px-1 py-0.5">
                      mailto:
                    </code>{" "}
                    to open the email client. Leave empty to hide.
                  </FormDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/tutorial/how-to-configure-status-page/#3-links"
                rel="noreferrer"
                target="_blank"
              >
                links
              </Link>
              .
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
