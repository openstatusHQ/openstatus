"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type * as z from "zod";

import { insertPageSchemaWithMonitors } from "@openstatus/db/src/schema";

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
import { api } from "@/trpc/client";
import DomainConfiguration from "../domains/domain-configuration";
import { LoadingAnimation } from "../loading-animation";

const customDomain = insertPageSchemaWithMonitors.pick({
  customDomain: true,
  id: true,
});

type Schema = z.infer<typeof customDomain>;

export function CustomDomainForm({ defaultValues }: { defaultValues: Schema }) {
  const form = useForm<Schema>({
    resolver: zodResolver(customDomain),
    defaultValues,
  });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(data: Schema) {
    console.log(data);
    // if new
    startTransition(async () => {
      if (defaultValues.id) {
        await api.page.addCustomDomain.mutate({
          customDomain: data.customDomain,
          pageId: defaultValues?.id,
        });
      }
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
      router.refresh();
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
                <Input placeholder="acme.com" {...field} />
              </FormControl>
              <FormDescription>
                The custom domain for your status page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-full">
          <Button className="w-full sm:w-auto">
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
