"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { PutBlobResult } from "@vercel/blob";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";

import { insertPageSchema } from "@openstatus/db/src/schema";
import type { InsertPage, Monitor } from "@openstatus/db/src/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  InputWithAddons,
} from "@openstatus/ui";

import { useDebounce } from "@/hooks/use-debounce";
import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { toast, toastAction } from "@/lib/toast";
import { slugify } from "@/lib/utils";
import { api } from "@/trpc/client";
import { LoadingAnimation } from "../loading-animation";

interface Props {
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
}

export function StatusPageForm({
  defaultValues,
  allMonitors,
  checkAllMonitors,
  nextUrl,
}: Props) {
  const form = useForm<InsertPage>({
    resolver: zodResolver(insertPageSchema),
    defaultValues: {
      title: defaultValues?.title || "", // FIXME: you can save a page without title, causing unexpected slug behavior
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
      workspaceId: defaultValues?.workspaceId || 0,
      id: defaultValues?.id || 0,
      monitors:
        checkAllMonitors && allMonitors
          ? allMonitors.map(({ id }) => id)
          : defaultValues?.monitors ?? [],
      customDomain: defaultValues?.customDomain || "",
      icon: defaultValues?.icon || "",
    },
  });
  const router = useRouter();
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const watchSlug = form.watch("slug");
  const watchTitle = form.watch("title");
  const debouncedSlug = useDebounce(watchSlug, 1000); // using debounce to not exhaust the server
  const updateSearchParams = useUpdateSearchParams();

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
        if (defaultValues) {
          await api.page.update.mutate(props);
        } else {
          const page = await api.page.create.mutate(props);
          const id = page?.id || null;
          router.replace(`?${updateSearchParams({ id })}`); // to stay on same page and enable 'Advanced' tab
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
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  };

  const handleChange = async (file: FileList | null) => {
    if (!file || file.length === 0) {
      return;
    }

    console.log(file[0]);
    const response = await fetch(`/api/upload?filename=${file[0].name}`, {
      method: "POST",
      body: file[0],
    });

    const newblob = (await response.json()) as PutBlobResult;
    console.log(newblob.url);
    form.setValue("icon", newblob.url);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const isUnique = await checkUniqueSlug();
          if (!isUnique) {
            // the user will already have the "error" message - we include a toast as well
            toastAction("unique-slug");
          } else {
            if (onSubmit) {
              void form.handleSubmit(onSubmit)(e);
            }
          }
        }}
        className="grid w-full gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="my-1.5 flex flex-col gap-2">
            <p className="text-sm font-semibold leading-none">Endpoint Check</p>
            <p className="text-muted-foreground text-sm">
              The easiest way to get started.
            </p>
          </div>
          <div className="grid gap-6 sm:col-span-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Documenso Status" {...field} />
                  </FormControl>
                  <FormDescription>The title of your page.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <InputWithAddons
                      placeholder="documenso"
                      trailing={".openstatus.dev"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The subdomain for your status page. At least 3 chars.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monitors"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Monitor</FormLabel>
                    <FormDescription>
                      Select the monitors you want to display.
                    </FormDescription>
                  </div>
                  {allMonitors?.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="monitors"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...(field.value || []),
                                        item.id,
                                      ])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item.id,
                                        ),
                                      );
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                {item.name}
                              </FormLabel>
                              <FormDescription className="truncate">
                                {item.url}
                              </FormDescription>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced-settings">
            <AccordionTrigger>Advanced Settings</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="my-1.5 flex flex-col gap-2">
                  <p className="text-sm font-semibold leading-none">
                    More Configurations
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Make it your own. Contact us if you wish for more and we
                    will implement it!
                  </p>
                </div>
                <div className="grid gap-6 sm:col-span-2 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-full">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Stay informed about our api and website health."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide your users informations about it.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Favicon</FormLabel>
                        <FormControl>
                          <>
                            {!field.value && (
                              <Input
                                type="file"
                                accept="image/x-icon,image/png"
                                ref={inputFileRef}
                                onChange={(e) => handleChange(e.target.files)}
                              />
                            )}
                            {field.value && (
                              <div className="flex items-center">
                                <div className="border-border h-10 w-10 rounded-sm border p-1">
                                  <Image
                                    src={field.value}
                                    width={64}
                                    height={64}
                                    alt="Favicon"
                                  />
                                </div>
                                <Button
                                  variant="link"
                                  onClick={() => {
                                    form.setValue("icon", "");
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            )}
                          </>
                        </FormControl>
                        <FormDescription>
                          Your status page favicon
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex sm:justify-end">
          <Button className="w-full sm:w-auto" size="lg">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
