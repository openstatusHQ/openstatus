"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Link } from "@/components/common/link";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isTRPCClientError } from "@trpc/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REGIONS = ["us", "eu"];

const schema = z.object({
  name: z.string(),
  provider: z.literal("opsgenie"),
  data: z.record(z.string(), z.string()),
  monitors: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormOpsGenie({
  defaultValues,
  onSubmit,
  className,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  monitors: { id: number; name: string }[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      provider: "opsgenie",
      data: {
        apiKey: "",
        region: undefined,
      },
      monitors: [],
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
      <form
        className={cn("grid gap-4", className)}
        onSubmit={form.handleSubmit(submitAction)}
        {...props}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Notifier" {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Enter a descriptive name for your notifier.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="data.apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API key</FormLabel>
              <FormControl>
                <Input placeholder="xxx-yyy-zzz" required {...field} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Enter the API key. <Link href="#">Read more</Link>.
              </FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="data.region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Region</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
              <FormDescription>The region is required.</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monitors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monitors</FormLabel>
              <FormDescription>
                Select the monitors you want to notify.
              </FormDescription>
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      id="all"
                      checked={field.value?.length === monitors.length}
                      onCheckedChange={(checked) => {
                        field.onChange(
                          checked ? monitors.map((m) => m.id) : []
                        );
                      }}
                    />
                  </FormControl>
                  <Label htmlFor="all">Select all</Label>
                </div>
                {monitors.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        id={String(item.id)}
                        checked={field.value?.includes(item.id)}
                        onCheckedChange={(checked) => {
                          const newValue = checked
                            ? [...(field.value || []), item.id]
                            : field.value?.filter((id) => id !== item.id);
                          field.onChange(newValue);
                        }}
                      />
                    </FormControl>
                    <Label htmlFor={String(item.id)}>{item.name}</Label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
