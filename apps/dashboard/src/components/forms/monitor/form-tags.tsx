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
} from "@/components/forms/form-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  tags: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      color: z.string(),
    })
  ),
});

type FormValues = z.infer<typeof schema>;

export function FormTags({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit?: (values: FormValues) => Promise<void> | void;
}) {
  const trpc = useTRPC();
  const { data: tags } = useQuery(trpc.monitorTag.list.queryOptions());

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      tags: [],
    },
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        onSubmit?.(values);
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

  if (!tags) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Tags</FormCardTitle>
            <FormCardDescription>
              Add tags to categorize and organize your monitor.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem className="flex flex-col md:col-span-1">
                  <FormLabel>Tags</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "h-auto min-h-9 w-full justify-between",
                            !field.value?.length && "text-muted-foreground"
                          )}
                        >
                          <div className="group/badges -space-x-2 flex flex-wrap">
                            {field.value.length ? (
                              field.value.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  className="relative flex translate-x-0 items-center gap-1.5 bg-background transition-transform hover:z-10 hover:translate-x-1"
                                >
                                  <div
                                    className={cn(
                                      "size-2.5 rounded-full",
                                      tag.color
                                    )}
                                  />
                                  {tag.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">
                                No tags selected
                              </span>
                            )}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Search tags..." />
                        <CommandList className="w-full">
                          <CommandEmpty>No tag found.</CommandEmpty>
                          <CommandGroup>
                            {tags?.map((tag) => (
                              <CommandItem
                                value={tag.name}
                                key={tag.id}
                                onSelect={() => {
                                  if (
                                    field.value
                                      .map((tag) => tag.id)
                                      ?.includes(tag.id)
                                  ) {
                                    form.setValue(
                                      "tags",
                                      field.value.filter(
                                        (value) => value.id !== tag.id
                                      )
                                    );
                                  } else {
                                    form.setValue("tags", [
                                      ...(field.value ?? []),
                                      {
                                        id: tag.id,
                                        name: tag.name,
                                        color: tag.color,
                                      },
                                    ]);
                                  }
                                }}
                              >
                                <div
                                  className={cn(
                                    "mr-2 h-4 w-4 rounded-full",
                                    tag.color
                                  )}
                                />
                                {tag.name}
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    field.value
                                      ?.map((tag) => tag.id)
                                      ?.includes(tag.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about <Link href="#">tags</Link> and how to use them.
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
