"use client";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { config } from "@/data/notifications.client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NotificationProvider } from "@openstatus/db/src/schema";
import { isTRPCClientError } from "@trpc/client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  notifiers: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormNotifiers({
  defaultValues,
  onSubmit,
  notifiers,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  notifiers: { id: number; name: string; provider: NotificationProvider }[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      notifiers: [],
    },
  });
  const watchNotifiers = form.watch("notifiers");
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => "Saved",
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
            <FormCardTitle>Notifications</FormCardTitle>
            <FormCardDescription>
              Get notified when your monitor is degraded or down.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            {notifiers.length > 0 ? (
              <FormField
                control={form.control}
                name="notifiers"
                render={() => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">
                        List of Notifications
                      </FormLabel>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className={cn(
                          watchNotifiers.length === notifiers.length &&
                            "text-muted-foreground",
                        )}
                        onClick={() => {
                          const allSelected = notifiers.every((item) =>
                            watchNotifiers.includes(item.id),
                          );

                          if (!allSelected) {
                            form.setValue(
                              "notifiers",
                              notifiers.map((item) => item.id),
                            );
                          } else {
                            form.setValue("notifiers", []);
                          }
                        }}
                      >
                        Select all
                      </Button>
                    </div>
                    {notifiers.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="notifiers"
                        render={({ field }) => {
                          const Icon = config[item.provider].icon;
                          const label = config[item.provider].label;
                          return (
                            <FormItem
                              key={item.id}
                              className="flex items-center"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={
                                    field.value?.includes(item.id) || false
                                  }
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([
                                          ...field.value,
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
                              <FormLabel className="font-normal text-sm">
                                {item.name}{" "}
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-px font-mono text-[10px]"
                                >
                                  <Icon className="size-2.5" />
                                  {label}
                                </Badge>
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <EmptyStateContainer>
                <EmptyStateTitle>No notifications</EmptyStateTitle>
              </EmptyStateContainer>
            )}
          </FormCardContent>
          <FormCardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
