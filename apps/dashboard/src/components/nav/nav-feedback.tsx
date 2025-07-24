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
import { useEffect, useState, useCallback, useRef } from "react";
import { Kbd } from "@/components/common/kbd";
import { useIsMobile } from "@/hooks/use-mobile";
import { AudioLines, Inbox, LoaderCircle, Mic } from "lucide-react";

const schema = z.object({
  message: z.string().min(1),
});

export function NavFeedback() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      message: "",
    },
  });
  const trpc = useTRPC();
  const feedbackMutation = useMutation(trpc.feedback.submit.mutationOptions());
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      console.log("speech recognition API supported");
    } else {
      console.log("speech recognition API not supported");
    }

    const SpeechRecognitionCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition;

    // Browser not supported
    if (!SpeechRecognitionCtor) return;

    const recognition: SpeechRecognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      form.setValue(
        "message",
        `${form.getValues("message") ?? ""}${transcript} `
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [form]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch {
        // recognition already started, ignore
      }
    }
  };

  const onSubmit = useCallback(
    async (values: z.infer<typeof schema>) => {
      const promise = feedbackMutation.mutateAsync({
        ...values,
        path: window.location.pathname,
        isMobile,
      });
      toast.promise(promise, {
        loading: "Sending feedback...",
        success: "Feedback sent",
        error: "Failed to send feedback",
      });
      await promise;
    },
    [feedbackMutation, isMobile]
  );

  useEffect(() => {
    if (!open && feedbackMutation.isSuccess) {
      // NOTE: the popover takes 300ms to close, so we need to wait for that
      setTimeout(() => feedbackMutation.reset(), 300);
    }
  }, [open, feedbackMutation]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (open && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        form.handleSubmit(onSubmit)();
      }

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping) return;

      if (!open) {
        if (e.key === "f") {
          e.preventDefault();
          setOpen(true);
        }
        return;
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

  if (isMobile) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group gap-0 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=open]:text-foreground"
        >
          Feedback{" "}
          <Kbd className="group-data-[state=open]:text-foreground group-hover:text-foreground font-mono">
            F
          </Kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="relative p-0 border-none">
        {feedbackMutation.isSuccess ? (
          <div className="p-3 h-[110px] flex flex-col gap-1 items-center justify-center rounded-md border border-input text-base shadow-xs">
            <Inbox className="size-4 shrink-0" />
            <p className="font-medium text-center">Thanks for sharing!</p>
            <p className="text-muted-foreground text-sm text-center">
              We&apos;ll get in touch if there&apos;s a follow-up.
            </p>
          </div>
        ) : (
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
                        placeholder="Ideas, bugs, or anything else..."
                        className="resize-none p-3 field-sizing-fixed h-[110px]"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {recognitionRef.current && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="absolute group bottom-1.5 left-1.5 gap-0"
                  onClick={toggleListening}
                >
                  {isListening ? (
                    <AudioLines className="size-4 animate-pulse" />
                  ) : (
                    <Mic className="size-4" />
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="absolute group bottom-1.5 right-1.5 gap-0"
                type="submit"
                disabled={feedbackMutation.isPending}
              >
                {feedbackMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <>
                    Send
                    <Kbd className="group-hover:text-foreground font-mono">
                      ⌘
                    </Kbd>
                    <Kbd className="group-hover:text-foreground font-mono">
                      ↵
                    </Kbd>
                  </>
                )}
              </Button>
            </form>
          </Form>
        )}
      </PopoverContent>
    </Popover>
  );
}
