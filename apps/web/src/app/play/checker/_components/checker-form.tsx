"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

const formSchema = z.object({
  url: z.string().url(), // add pattern and use InputWithAddon `https://`
  method: z.enum(METHODS).default("GET"),
});

type FormSchema = z.infer<typeof formSchema>;

export function CheckerForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { method: "GET", url: "" },
  });

  function onSubmit(data: FormSchema) {
    startTransition(async () => {
      const { url, method } = data;
      try {
        const res = await fetch("/play/checker/api", {
          method: "POST",
          body: JSON.stringify({ url, method }),
        });
        const { uuid } = (await res.json()) as { uuid?: string };
        if (typeof uuid === "string") {
          router.push(`/play/checker/${uuid}`);
        }
      } catch {
        // TODO: better error handling, including e.g. toast
        form.setError("url", { message: "Something went wrong" });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem className="col-span-1">
                <FormLabel className="sr-only">Method</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="col-span-3">
                <FormLabel className="sr-only">URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://documenso.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-full mt-2 sm:col-span-1">
            <Button disabled={isPending} className="h-10 w-full">
              {isPending ? <LoadingAnimation /> : "Check"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
