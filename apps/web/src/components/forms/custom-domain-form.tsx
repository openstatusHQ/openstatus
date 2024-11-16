"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import { selectPageSchema } from "@openstatus/db/src/schema";
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  InputWithAddons,
} from "@openstatus/ui";

import { useDomainStatus } from "@/hooks/use-domain-status";
import { toast, toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";
import DomainConfiguration from "../domains/domain-configuration";
import DomainStatusIcon from "../domains/domain-status-icon";
import { LoadingAnimation } from "../loading-animation";

const customDomain = selectPageSchema.pick({
  customDomain: true,
  id: true,
});

type Schema = z.infer<typeof customDomain>;

// TODO: check

export function CustomDomainForm({ defaultValues }: { defaultValues: Schema }) {
  const form = useForm<Schema>({
    resolver: zodResolver(customDomain),
    defaultValues,
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const domainStatus = useDomainStatus(defaultValues?.customDomain);
  const { status } = domainStatus || {};

  async function onSubmit(data: Schema) {
    startTransition(async () => {
      try {
        if (data.customDomain.toLowerCase().includes("openstatus")) {
          toast.error("Domain cannot contain 'openstatus'");
          return;
        }

        await api.page.addCustomDomain.mutate({
          customDomain: data.customDomain,
          pageId: defaultValues?.id,
        });

        if (data.customDomain && !defaultValues.customDomain) {
          await api.domain.addDomainToVercel.mutate({
            domain: data.customDomain,
          });
          // if changed, remove old domain and add new one
        } else if (
          defaultValues.customDomain &&
          data.customDomain !== defaultValues.customDomain
        ) {
          await api.domain.removeDomainFromVercelProject.mutate({
            domain: defaultValues.customDomain,
          });
          await api.domain.addDomainToVercel.mutate({
            domain: data.customDomain,
          });
          // if removed
        } else if (data.customDomain === "") {
          await api.domain.removeDomainFromVercelProject.mutate({
            domain: defaultValues.customDomain,
          });
        }
        toastAction("saved");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
      >
        <FormField
          control={form.control}
          name="customDomain"
          render={({ field }) => (
            <FormItem className="sm:col-span-4">
              <FormLabel>Custom Domain</FormLabel>
              <FormControl>
                <div className="flex items-center space-x-3">
                  <InputWithAddons
                    placeholder="status.documenso.com"
                    leading="https://"
                    {...field}
                  />
                  <div className="h-full w-7">
                    {/* TODO: add loading state */}
                    {status ? <DomainStatusIcon status={status} /> : null}
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                The custom domain for your status page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-full">
          <Button className="w-full sm:w-auto" size="lg">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
        <div className="sm:col-span-5">
          {defaultValues?.customDomain ? (
            <DomainConfiguration domain={defaultValues.customDomain} />
          ) : null}
        </div>
      </form>
    </Form>
  );
}
