"use client";

import { Note } from "@/components/common/note";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BlueskyIcon,
  GitHubIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { cn } from "@openstatus/ui/lib/utils";
import {
  Check,
  MoreHorizontal,
  Newspaper,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const sources = [
  { id: "search-engine", title: "Search Engine", icon: Search },
  { id: "github", title: "GitHub", icon: GitHubIcon },
  { id: "linkedin", title: "LinkedIn", icon: LinkedInIcon },
  { id: "bluesky", title: "Bluesky", icon: BlueskyIcon },
  { id: "twitter", title: "X / Twitter", icon: XIcon },
  { id: "ai-chat", title: "AI Chat", icon: Sparkles },
  { id: "recommendation", title: "Friend / Colleague", icon: Users },
  { id: "youtube", title: "YouTube", icon: YouTubeIcon },
  { id: "blog", title: "Blog / Article", icon: Newspaper },
  { id: "other", title: "Other", icon: MoreHorizontal },
] as const;

const schema = z.object({
  source: z.string().min(1, "Please select an option"),
  other: z.string().optional(),
});

export type FormValues = z.infer<typeof schema>;

export function QuestionForm({
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
      source: "",
      other: "",
    },
  });
  const watchSource = form.watch("source");

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
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-wrap gap-2"
                >
                  {sources.map((item) => {
                    const selected = field.value === item.id;
                    return (
                      <FormItem key={item.id} className="space-y-0">
                        <FormControl>
                          <RadioGroupItem
                            value={item.id}
                            id={item.id}
                            className="sr-only"
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor={item.id}
                          className="cursor-pointer font-normal"
                        >
                          <Badge
                            variant={selected ? "default" : "outline"}
                            className={cn(
                              "transition-colors",
                              !selected &&
                                "text-muted-foreground hover:border-foreground hover:text-foreground",
                            )}
                          >
                            <item.icon className="size-3" />
                            {item.title}
                          </Badge>
                        </FormLabel>
                      </FormItem>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          {watchSource === "other" && (
            <FormField
              control={form.control}
              name="other"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Please specify..."
                      className="w-full"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <Button
            size="sm"
            type="submit"
            disabled={isPending || !watchSource}
            variant="default"
          >
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
