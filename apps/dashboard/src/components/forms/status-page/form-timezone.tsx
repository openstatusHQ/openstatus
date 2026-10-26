"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Expand, Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { timeZoneShortName } from "@openstatus/utils";
import { isTRPCClientError } from "@trpc/client";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
  FormCardUpgrade,
} from "@/components/forms/form-card";

const schema = z.object({
  defaultTimezone: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

// "Asia/Tokyo (GMT+9)": the short name the public page appends to its
// timestamps (in English), so what is picked here is what readers will see.
function zoneLabel(timeZone: string) {
  const name = timeZoneShortName(timeZone);
  return name === timeZone ? timeZone : `${timeZone} (${name})`;
}

export function FormTimezone({
  defaultValues,
  onSubmit,
  locked,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  locked?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const zones = useMemo(
    () =>
      // some engines list UTC themselves, others do not
      [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])].map(
        (zone) => ({
          zone,
          label: zoneLabel(zone),
        }),
      ),
    [],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { defaultTimezone: "UTC" },
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
          {locked ? <FormCardUpgrade /> : null}
          <FormCardHeader>
            <FormCardTitle>Time zone</FormCardTitle>
            <FormCardDescription>
              The time zone your status page shows its timestamps and daily bars
              in. Every visitor sees the same time.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="defaultTimezone"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Time zone</FormLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          disabled={locked}
                          className="w-full justify-between font-normal sm:max-w-md"
                        >
                          {zoneLabel(field.value)}
                          <Expand className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
                      <Command>
                        <CommandInput placeholder="Search time zone..." />
                        <CommandList>
                          <CommandEmpty>No time zone found.</CommandEmpty>
                          <CommandGroup>
                            {zones.map(({ zone, label }) => (
                              <CommandItem
                                key={zone}
                                value={zone}
                                keywords={[label]}
                                onSelect={() => {
                                  field.onChange(zone);
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    zone === field.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Days on the status bars start at midnight in this zone.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>Defaults to UTC.</FormCardFooterInfo>
            {locked ? (
              <Button
                data-track="paywall_viewed"
                data-limit="timezone"
                type="button"
                asChild
              >
                <Link href="/settings/billing">
                  <Lock className="size-4" />
                  Upgrade
                </Link>
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
