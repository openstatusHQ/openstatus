"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Calendar } from "@openstatus/ui/components/ui/calendar";
import { DialogFooter } from "@openstatus/ui/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import { format, parse } from "date-fns";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

export const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
  // Single-value radio. The wire format on the create-key API is
  // an array (`scopes: Scope[]`) so per-resource scopes can land
  // additively later, but the v1 dashboard surface only ever picks
  // one of two options — flat enum here, lift to array on submit.
  //
  // Duplicates `apiKeySettableScopes` from `@openstatus/db` — the
  // dashboard's client bundle can't reach into the db package
  // (drizzle pulls in node-only deps via the schema barrel). The
  // services input schema validates whatever the form sends, so
  // drift here surfaces as a parse error on submit, not a silent
  // mismatch. Keep this list in sync with
  // `packages/db/src/schema/api-keys/constants.ts`.
  scope: z.enum(["read", "write"]),
});

export type FormValues = z.infer<typeof schema>;

interface ApiKeyFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel?: () => void;
  submitDisabled?: boolean;
}

export function ApiKeyForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitDisabled,
}: ApiKeyFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      expiresAt: defaultValues?.expiresAt ?? "",
      // Default Read-only: AI agents are the most common new use
      // case for keys, and read-only is the safer starting point.
      // CI/CD users actively pick "Read & write."
      scope: defaultValues?.scope ?? "read",
    },
  });

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Creating...",
          success: () => "Created",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to create API key";
          },
        });
        await promise;
        form.reset();
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Production API" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Used for production deployment"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Access</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="gap-3 sm:grid-cols-2"
                  >
                    <label className="hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <RadioGroupItem value="read" className="mt-1" />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Read-only</div>
                        <div className="text-muted-foreground text-xs">
                          Recommended for AI agents and read-only dashboards.
                        </div>
                      </div>
                    </label>
                    <label className="hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <RadioGroupItem value="write" className="mt-1" />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          Read &amp; write
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Required for CI/CD and automation.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Expiration Date</FormLabel>
                <Popover modal>
                  <FormControl>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(
                            parse(field.value, "yyyy-MM-dd", new Date()),
                            "PPP",
                          )
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                  </FormControl>
                  <PopoverContent
                    className="pointer-events-auto w-auto p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={
                        field.value
                          ? parse(field.value, "yyyy-MM-dd", new Date())
                          : undefined
                      }
                      onSelect={(date) => {
                        if (!date) {
                          field.onChange("");
                          return;
                        }
                        field.onChange(format(date, "yyyy-MM-dd"));
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const compareDate = new Date(date);
                        compareDate.setHours(0, 0, 0, 0);
                        return compareDate < today;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Leave empty if the key should never expire.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || submitDisabled}>
            Create
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
