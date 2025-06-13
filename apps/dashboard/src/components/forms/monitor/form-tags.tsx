"use client";

import { Button } from "@/components/ui/button";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Link } from "@/components/common/link";
import { Badge } from "@/components/ui/badge";
import { monitorTags } from "@/data/monitor-tags";

const schema = z.object({
  tags: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
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
          success: () => JSON.stringify(values),
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
                                  key={tag.value}
                                  variant="outline"
                                  className="relative flex translate-x-0 items-center gap-1.5 bg-background transition-transform hover:z-10 hover:translate-x-1"
                                >
                                  <div
                                    className={cn(
                                      "size-2.5 rounded-full",
                                      tag.color
                                    )}
                                  />
                                  {tag.label}
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
                            {monitorTags.map((tag) => (
                              <CommandItem
                                value={tag.label}
                                key={tag.value}
                                onSelect={() => {
                                  if (
                                    field.value
                                      .map((tag) => tag.value)
                                      ?.includes(tag.value)
                                  ) {
                                    form.setValue(
                                      "tags",
                                      field.value.filter(
                                        (value) => value.value !== tag.value
                                      )
                                    );
                                  } else {
                                    form.setValue("tags", [
                                      ...(field.value ?? []),
                                      {
                                        value: tag.value,
                                        label: tag.label,
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
                                {tag.label}
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    field.value
                                      ?.map((tag) => tag.value)
                                      ?.includes(tag.value)
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
