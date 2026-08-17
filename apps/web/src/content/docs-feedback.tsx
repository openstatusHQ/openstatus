"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Inbox, Loading } from "@openstatus/icons";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@openstatus/ui/components/ui/form";
import { Kbd } from "@openstatus/ui/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toastAction } from "../lib/toast";

type Rating = "up" | "down";

const ratingKey = (path: string) => `docs-rating:${path}`;

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
});

type FeedbackBody =
  | { kind: "rating"; path: string; rating: Rating; previous?: Rating }
  | { kind: "message"; path: string; message: string };

// never throws; returns whether the server accepted the submission
async function postFeedback(body: FeedbackBody): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function DocsFeedbackBar({ path }: { path: string }) {
  const [rating, setRating] = useState<Rating>();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { message: "" },
  });

  // rehydrate a prior vote so the chosen arrow stays highlighted across loads
  useEffect(() => {
    const stored = window.localStorage.getItem(ratingKey(path));
    if (stored === "up" || stored === "down") setRating(stored);
  }, [path]);

  // reset the popover contents shortly after it closes (300ms = close anim)
  useEffect(() => {
    if (!open && sent) {
      const t = setTimeout(() => {
        setSent(false);
        form.reset();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, sent, form]);

  function rate(value: Rating) {
    // read the prior vote from localStorage (not state) so a click before the
    // hydration effect still reports the correct `previous` to the server
    const stored = window.localStorage.getItem(ratingKey(path));
    const previous = stored === "up" || stored === "down" ? stored : undefined;
    if (previous === value) return;
    setRating(value);
    window.localStorage.setItem(ratingKey(path), value);
    void postFeedback({ kind: "rating", path, rating: value, previous });
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    const ok = await postFeedback({
      kind: "message",
      path,
      message: values.message,
    });
    if (ok) {
      setSent(true);
    } else {
      toastAction("error");
    }
  }

  return (
    <div className="text-sm">
      <p className="text-foreground py-2 font-mono font-medium">
        Was this helpful?
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="bg-border text-muted-foreground [&>*]:bg-background [&>*]:hover:bg-muted flex items-stretch gap-px border font-mono [&>*]:flex [&>*]:items-center [&>*]:justify-center [&>*]:py-2 [&>*]:transition-colors [&>*]:disabled:pointer-events-none">
          <button
            type="button"
            aria-label="Yes, this page was helpful"
            data-active={rating === "up"}
            onClick={() => rate("up")}
            className="hover:text-success data-[active=true]:bg-muted data-[active=true]:text-success w-10"
          >
            <span className="leading-none" aria-hidden="true">
              ▲
            </span>
          </button>
          <button
            type="button"
            aria-label="No, this page was not helpful"
            data-active={rating === "down"}
            onClick={() => rate("down")}
            className="hover:text-destructive data-[active=true]:bg-muted data-[active=true]:text-destructive w-10"
          >
            <span className="leading-none" aria-hidden="true">
              ▼
            </span>
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-active={open}
              className="hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground flex-1"
            >
              Send feedback
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          align="end"
          side="bottom"
          className="w-64 rounded-none p-0"
        >
          {sent ? (
            <div className="flex flex-col items-center justify-center gap-1 p-3">
              <Inbox className="size-4 shrink-0" />
              <p className="text-center text-sm font-medium">
                Thanks for sharing!
              </p>
              <p className="text-muted-foreground text-center text-xs">
                We read every note.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form className="relative" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Feedback</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ideas, corrections, or anything missing..."
                          className="field-sizing-fixed h-[110px] resize-none rounded-none p-3"
                          rows={4}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              e.preventDefault();
                              void form.handleSubmit(onSubmit)();
                            }
                          }}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground absolute right-2 bottom-2 flex items-center font-mono text-sm disabled:opacity-50"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Loading className="size-4 animate-spin" />
                  ) : (
                    <>
                      Send
                      <Kbd className="ml-1 font-mono">⌘</Kbd>
                      <Kbd className="ml-1 font-mono">↵</Kbd>
                    </>
                  )}
                </button>
              </form>
            </Form>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DocsFeedback() {
  const pathname = usePathname();
  // key by path so rating + popover state reset when navigating between docs
  return <DocsFeedbackBar key={pathname} path={pathname} />;
}
