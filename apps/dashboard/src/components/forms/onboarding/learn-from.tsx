"use client";

import { Note } from "@/components/common/note";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const learnedFrom = [
  {
    id: "twitter",
    title: "Twitter / X",
  },
  {
    id: "bsky",
    title: "Bluesky",
  },
  {
    id: "linkedin",
    title: "LinkedIn",
  },
  {
    id: "reddit",
    title: "Reddit",
  },
  {
    id: "github",
    title: "GitHub",
  },
  {
    id: "friends",
    title: "Friends or Colleagues",
  },
  {
    id: "seo",
    title: "Search Engine (Google, Bing, etc.)",
  },
  {
    id: "newsletter",
    title: "Blog post or Newsletter",
  },
  {
    id: "other",
    title: "Other",
  },
] as const;

const schema = z.object({
  from: z.string(),
  other: z.string().optional(),
});

export type FormValues = z.infer<typeof schema>;

export function LearnFromForm({
  onSubmit,
  defaultValues,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      from: "",
      other: "",
    },
  });
  const watchFrom = form.watch("from");

  function handleSubmit(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Submitting...",
          success: () => "Submitted",
          error: "Failed to submit",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (!isPending && form.formState.isSubmitSuccessful) {
    return (
      <Note color="success">
        <Check />
        Thank you for your feedback!
      </Note>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
        {...props}
      >
        <FormField
          control={form.control}
          name="from"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  {learnedFrom.map((item) => (
                    <FormItem key={item.id} className="flex items-center gap-3">
                      <FormControl>
                        <RadioGroupItem value={item.id} id={item.id} />
                      </FormControl>
                      <FormLabel
                        htmlFor={item.id}
                        className="w-full font-normal"
                      >
                        {item.title}
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {watchFrom === "other" && (
          <FormField
            control={form.control}
            name="other"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Please specify"
                    className="sm:w-1/2"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <Button size="sm" type="submit" disabled={isPending}>
          {isPending ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
