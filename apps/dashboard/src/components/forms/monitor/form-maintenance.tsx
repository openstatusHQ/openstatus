"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { monitorMaintenanceModes } from "@openstatus/db/src/schema/monitors/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@openstatus/ui/components/ui/form";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { useTransition } from "react";
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
  FormCardTitle,
} from "@/components/forms/form-card";

export const MAINTENANCE_MODE_DEFAULT = "pause";

const schema = z.object({
  maintenanceMode: z.enum(monitorMaintenanceModes),
});

type FormValues = z.infer<typeof schema>;

const options: {
  value: FormValues["maintenanceMode"];
  label: string;
  description: string;
}[] = [
  {
    value: "pause",
    label: "Pause checks",
    description:
      "No checks run while the maintenance is active. That time is left out of uptime entirely.",
  },
  {
    value: "continue",
    label: "Keep checking without alerting",
    description:
      "Checks run and are recorded as usual, so failures count against uptime. The status does not change, no incident opens and nobody is notified.",
  },
];

const optionClassName =
  "hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3";

export function FormMaintenance({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      maintenanceMode: MAINTENANCE_MODE_DEFAULT,
    },
  });
  const [isPending, startTransition] = useTransition();

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
        <FormCard id="maintenance">
          <FormCardHeader>
            <FormCardTitle>Maintenance</FormCardTitle>
            <FormCardDescription>
              Choose what happens while a status page maintenance covers this
              monitor.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="maintenanceMode"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      aria-label="During maintenance"
                      value={field.value}
                      onValueChange={field.onChange}
                      className="gap-3"
                    >
                      {options.map((option) => (
                        <label key={option.value} className={optionClassName}>
                          <RadioGroupItem
                            value={option.value}
                            className="mt-1"
                          />
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium">
                              {option.label}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {option.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://www.openstatus.dev/docs/reference/maintenance#checks-during-maintenance"
                rel="noreferrer"
                target="_blank"
              >
                checks during maintenance
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
