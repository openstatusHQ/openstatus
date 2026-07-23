"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { Plus, X } from "lucide-react";
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

const schema = z.object({
  proxyUrl: z.union([z.literal(""), z.url("Please enter a valid URL")]),
  proxyRegion: z.string().prefault(""),
  proxyHeaders: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .prefault([]),
});

type FormValues = z.input<typeof schema>;

export function FormProxy({
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
      proxyUrl: "",
      proxyRegion: "",
      proxyHeaders: [],
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
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Check Proxy</FormCardTitle>
            <FormCardDescription>
              Run the check through your own proxy (e.g. a serverless function)
              to monitor from a location where no probe is available.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="proxyUrl"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Proxy URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://my-function.cn-hangzhou.fcapp.run/check"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The proxy performs the request against your endpoint and
                    reports the measured latency back. Leave empty to check
                    directly from our probes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxyRegion"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Region label</FormLabel>
                  <FormControl>
                    <Input placeholder="cn-hangzhou" {...field} />
                  </FormControl>
                  <FormDescription>
                    Stored with the check results. When empty, the region
                    reported by the proxy response is used.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxyHeaders"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Proxy Headers</FormLabel>
                  <FormDescription>
                    Sent to the proxy itself (e.g. authentication), not to the
                    monitored endpoint.
                  </FormDescription>
                  {field.value?.map((header, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-5">
                      <Input
                        placeholder="Key"
                        className="col-span-2"
                        value={header.key}
                        onChange={(e) => {
                          const newHeaders = [...(field.value ?? [])];
                          newHeaders[index] = {
                            ...newHeaders[index],
                            key: e.target.value,
                          };
                          field.onChange(newHeaders);
                        }}
                      />
                      <Input
                        placeholder="Value"
                        className="col-span-2"
                        value={header.value}
                        onChange={(e) => {
                          const newHeaders = [...(field.value ?? [])];
                          newHeaders[index] = {
                            ...newHeaders[index],
                            value: e.target.value,
                          };
                          field.onChange(newHeaders);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const newHeaders = field.value?.filter(
                            (_, i) => i !== index,
                          );
                          field.onChange(newHeaders);
                        }}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        field.onChange([
                          ...(field.value ?? []),
                          { key: "", value: "" },
                        ]);
                      }}
                    >
                      <Plus />
                      Add Header
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://www.openstatus.dev/docs/monitoring/customization/check-proxy/"
                rel="noreferrer"
                target="_blank"
              >
                check proxies
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
