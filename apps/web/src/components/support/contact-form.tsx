"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Checkbox,
  Form,
  FormControl,
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
  Textarea,
} from "@openstatus/ui";

import { LoadingAnimation } from "../loading-animation";
import { handlePlainSupport } from "./action";
import { toast } from "@/lib/toast";

export const types = [
  {
    label: "Report a bug",
    value: "bug" as const,
  },
  {
    label: "Suggest a feature",
    value: "feature" as const,
  },
  {
    label: "Report a security issue",
    value: "security" as const,
  },
  {
    label: "Something else",
    value: "question" as const,
  },
];

export const FormSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["bug", "demo", "feature", "security", "question"]),
  email: z.string().email(),
  message: z.string().min(1),
  blocker: z.boolean().optional().default(false),
});

export type FormValues = z.infer<typeof FormSchema>;

interface ContactFormProps {
  defaultValues?: FormValues;
  onSubmit?: () => void;
}

export function ContactForm({
  defaultValues,
  onSubmit: handleSubmit,
}: ContactFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();

  async function onSubmit(data: FormValues) {
    startTransition(async () => {
      const result = await handlePlainSupport(data);
      if (result.error) {
        console.error(result.error);
        toast.error("Something went wrong. Please try again.");
      } else {
        handleSubmit?.();
        toast.success(
          "Your message has been sent! We will get back to you soon."
        );
      }
    });
  }

  const watchType = form.watch("type");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Max" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="max@openstatus.dev" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="What you need help with" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {watchType ? (
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea placeholder="Tell us about it..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        {watchType === "bug" ? (
          <FormField
            control={form.control}
            name="blocker"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="font-normal leading-none">
                  This bug prevents me from using the product.
                </FormLabel>
              </FormItem>
            )}
          />
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <LoadingAnimation /> : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
