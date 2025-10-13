"use client";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { Check, Copy } from "lucide-react";
import type React from "react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  key: z.string(),
  monitors: z.array(z.number()),
});

export type FormValues = z.infer<typeof schema>;

export function FormPrivateLocation({
  defaultValues,
  onSubmit,
  className,
  monitors,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  monitors: { id: number; name: string; url: string }[];
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      key: crypto.randomUUID(),
      monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const { copy, isCopied } = useCopyToClipboard();

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => "Saved",
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
        <FormCardContent>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Raspberry Pi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="key"
            disabled
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupInput
                      placeholder="Private Location Key"
                      readOnly
                      value={field.value}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label="Copy"
                        title="Copy"
                        size="icon-xs"
                        onClick={() => {
                          copy(field.value, {
                            successMessage: "Key copied to clipboard",
                          });
                        }}
                      >
                        {isCopied ? <Check /> : <Copy />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
        <FormCardSeparator />
        <FormCardContent>
          <FormField
            control={form.control}
            name="monitors"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monitors</FormLabel>
                <FormDescription>
                  Connected monitors will be automatically activated for the
                  private location.
                </FormDescription>
                {monitors.length ? (
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          id="all"
                          checked={field.value?.length === monitors.length}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked ? monitors.map((m) => m.id) : [],
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
                ) : (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No monitors found</EmptyStateTitle>
                  </EmptyStateContainer>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
