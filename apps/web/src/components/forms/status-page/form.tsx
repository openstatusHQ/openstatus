"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";

import { insertPageSchema } from "@openstatus/db/src/schema";
import type {
  InsertPage,
  Monitor,
  WorkspacePlan,
} from "@openstatus/db/src/schema";
import { Badge, Form } from "@openstatus/ui";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { toast, toastAction } from "@/lib/toast";
import { slugify } from "@/lib/utils";
import { api } from "@/trpc/client";
import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { SectionAdvanced } from "./section-advanced";
import { SectionMonitor } from "./section-monitor";
import { SectionVisibility } from "./section-visibility";

interface Props {
  defaultSection?: string;
  defaultValues?: InsertPage;
  allMonitors?: Monitor[];
  /**
   * gives the possibility to check all the monitors
   */
  checkAllMonitors?: boolean;
  /**
   * on submit, allows to push a url
   */
  nextUrl?: string;
  plan: WorkspacePlan;
  workspaceSlug: string;
}

export function StatusPageForm({
  defaultSection,
  defaultValues,
  allMonitors,
  checkAllMonitors,
  nextUrl,
  plan,
  workspaceSlug,
}: Props) {
  const form = useForm<InsertPage>({
    resolver: zodResolver(insertPageSchema),
    defaultValues: {
      title: defaultValues?.title || "", // FIXME: you can save a page without title, causing unexpected slug behavior
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
      workspaceId: defaultValues?.workspaceId || 0,
      id: defaultValues?.id || 0,
      customDomain: defaultValues?.customDomain || "",
      icon: defaultValues?.icon || "",
      password: defaultValues?.password || "",
      passwordProtected: defaultValues?.passwordProtected || false,
      showMonitorValues: defaultValues?.showMonitorValues || true,
      monitors:
        checkAllMonitors && allMonitors
          ? allMonitors.map(({ id }) => ({ monitorId: id, order: 0 }))
          : defaultValues?.monitors ?? [],
    },
  });
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const watchSlug = form.watch("slug");
  const watchTitle = form.watch("title");
  const debouncedSlug = useDebounce(watchSlug, 1000); // using debounce to not exhaust the server

  const checkUniqueSlug = useCallback(async () => {
    const isUnique = await api.page.getSlugUniqueness.query({
      slug: debouncedSlug,
    });
    return (
      isUnique ||
      debouncedSlug.toLowerCase() === defaultValues?.slug.toLowerCase()
    );
  }, [debouncedSlug, defaultValues?.slug]);

  useEffect(() => {
    async function watchSlugChanges() {
      const isUnique = await checkUniqueSlug();
      if (!isUnique) {
        form.setError("slug", {
          message: "Already taken. Please select another slug.",
        });
      } else {
        form.clearErrors("slug");
      }
    }

    void watchSlugChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkUniqueSlug, form.clearErrors, form.setError]);

  useEffect(() => {
    if (!defaultValues?.title) {
      form.setValue("slug", slugify(watchTitle));
    }
  }, [watchTitle, form, defaultValues?.title]);

  const onSubmit = async ({ ...props }: InsertPage) => {
    startTransition(async () => {
      try {
        const isUnique = await checkUniqueSlug();
        if (!isUnique) {
          // the user will already have the "error" message - we include a toast as well
          toastAction("unique-slug");
        } else {
          if (defaultValues) {
            await api.page.update.mutate(props);
          } else {
            await api.page.create.mutate(props);
          }

          toast.success("Saved successfully.", {
            description: "Your status page is ready to go.",
            action: {
              label: "Visit",
              onClick: () =>
                window.open(`https://${props.slug}.openstatus.dev`, "_blank")
                  ?.location,
            },
          });
          // otherwise, the form will stay dirty - keepValues is used to keep the current values in the form
          form.reset({}, { keepValues: true });
          if (nextUrl) {
            router.push(nextUrl);
          }
          router.refresh();
        }
      } catch {
        toastAction("error");
      }
    });
  };

  function onValueChange(value: string) {
    // REMINDER: we are not merging the searchParams here
    // we are just setting the section to allow refreshing the page
    const params = new URLSearchParams();
    params.set("section", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          void form.handleSubmit(onSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <General form={form} />
        <Tabs
          defaultValue={defaultSection}
          className="w-full"
          onValueChange={onValueChange}
        >
          <TabsList>
            <TabsTrigger value="monitors">
              Monitors{" "}
              {defaultValues?.monitors?.length ? (
                <Badge variant="secondary" className="ml-1">
                  {defaultValues.monitors.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="visibility">Visibility</TabsTrigger>
          </TabsList>
          <TabsContent value="monitors">
            <SectionMonitor form={form} monitors={allMonitors} />
          </TabsContent>
          <TabsContent value="advanced">
            <SectionAdvanced {...{ form }} />
          </TabsContent>
          <TabsContent value="visibility">
            <SectionVisibility {...{ form, plan, workspaceSlug }} />
          </TabsContent>
        </Tabs>
        <SaveButton
          isPending={isPending}
          isDirty={form.formState.isDirty}
          onSubmit={form.handleSubmit(onSubmit)}
        />
      </form>
    </Form>
  );
}
