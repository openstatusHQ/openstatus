"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState, useCallback } from "react";

const schema = z.object({
  message: z.string().min(1),
});

export function NavFeedback() {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      message: "",
    },
  });
  const trpc = useTRPC();
  const feedbackMutation = useMutation(trpc.feedback.submit.mutationOptions());

  const onSubmit = useCallback(
    async (values: z.infer<typeof schema>) => {
      const promise = feedbackMutation.mutateAsync(values);
      toast.promise(promise, {
        loading: "Sending feedback...",
        success: "Feedback sent",
        error: "Failed to send feedback",
      });
      await promise;
      setOpen(false);
    },
    [feedbackMutation, setOpen]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!open) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        form.handleSubmit(onSubmit)();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, form, onSubmit]);

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5 -mx-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=open]:text-foreground"
        >
          Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="relative p-0 border-none">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Feedback</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Feedback"
                      className="resize-none p-3"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute bottom-1.5 right-1.5"
              type="submit"
              disabled={feedbackMutation.isPending}
            >
              Send
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  );
}
