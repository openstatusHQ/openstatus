"use client";

import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";

import {
  FormCardContent,
  FormCardSeparator,
} from "@/components/forms/form-card";
import { useFormSheetDirty } from "@/components/forms/form-sheet";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@openstatus/ui/components/ui/button";
import { Form } from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { TelegramManualInput } from "../components/telegram-manual-input";
import { TelegramQRConnection } from "../components/telegram-qr-connection";

const schema = z.object({
  name: z.string(),
  provider: z.literal("telegram"),
  data: z.object({
    chatId: z.string(),
  }),
  chatType: z.enum(["group", "private"]),
  monitors: z.array(z.number()),
});

type FormValues = z.infer<typeof schema>;

export function FormTelegram({
  monitors,
  defaultValues,
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  monitors: { id: number; name: string }[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      provider: "telegram",
      data: {
        chatId: "",
      },
      chatType: "private",
      monitors: [],
    },
  });
  const [isPending, startTransition] = useTransition();
  const { setIsDirty } = useFormSheetDirty();
  const trpc = useTRPC();
  const sendTestMutation = useMutation(
    trpc.notification.sendTest.mutationOptions(),
  );

  const formIsDirty = form.formState.isDirty;
  React.useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty, setIsDirty]);

  // Create Telegram Token
  const { data: tokenData, isLoading: isTokenLoading } = useQuery({
    ...trpc.notification.createTelegramToken.queryOptions(),
    refetchOnWindowFocus: false,
  });

  const [mode, setMode] = React.useState<"qr" | "manual" | null>(null);
  const [flowStep, setFlowStep] = React.useState<"private" | "group">("private");
  const [privateChatId, setPrivateChatId] = React.useState<string | null>(null);

  // Start polling for updates
  const { data: updates } = useQuery({
    ...trpc.notification.getTelegramUpdates.queryOptions({
      privateChatId: flowStep === "group" ? privateChatId ?? undefined : undefined,
    }),
    enabled:
      !!tokenData?.token && !form.getValues("data.chatId") && mode === "qr",
    refetchInterval: 5000,
  });

  React.useEffect(() => {
    if (updates && updates.length > 0) {
      const lastUpdate = updates[updates.length - 1];
      
      // Phase 1: Private chat ID received
      if (lastUpdate.chatType === "private" && flowStep === "private") {
        setPrivateChatId(lastUpdate.chatId);
        setFlowStep("group");
        toast.success(
          `Connected to ${lastUpdate.user.first_name}'s account. Now add the bot to your group.`,
        );
      }
      // Phase 2: Group chat ID received
      else if (lastUpdate.chatType === "group" && flowStep === "group") {
        startTransition(() => {
          form.setValue("data.chatId", lastUpdate.chatId, {
            shouldDirty: true,
          });
          toast.success(
            `Connected to group "${lastUpdate.chatTitle || "Unknown"}"`,
          );
        });
      }
    }
  }, [updates, form, flowStep]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
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

  function testAction() {
    if (isPending) return;

    startTransition(async () => {
      try {
        const provider = form.getValues("provider");
        const data = form.getValues("data");
        const promise = sendTestMutation.mutateAsync({
          provider,
          data: {
            telegram: { chatId: data.chatId },
          },
        });
        toast.promise(promise, {
          loading: "Sending test...",
          success: "Test sent",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            if (error instanceof Error) {
              return error.message;
            }
            return "Failed to send test";
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
        <FormCardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Notifier" {...field} />
                </FormControl>
                <FormMessage />
                <FormDescription>
                  Enter a descriptive name for your notifier.
                </FormDescription>
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <Button
                type="button"
                variant={mode === "qr" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("qr")}
                className="cursor-pointer w-full"
              >
                Connect with QR
              </Button>
              <div className="flex items-center gap-2 min-w-[40px]">
                <div className="h-px bg-border flex-1" />
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Or
                </span>
                <div className="h-px bg-border flex-1" />
              </div>
              <Button
                type="button"
                variant={mode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("manual")}
                className="cursor-pointer w-full"
              >
                Enter ChatID manually
              </Button>
            </div>

            {mode === "manual" && <TelegramManualInput form={form} />}
            {mode === "qr" && (
              <TelegramQRConnection
                form={form}
                token={tokenData?.token}
                isLoading={isTokenLoading}
                isPolling={!!tokenData?.token && !form.getValues("data.chatId")}
                flowStep={flowStep}
                privateChatId={privateChatId}
              />
            )}
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={testAction}
            >
              Send Test
            </Button>
          </div>
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
                  Select the monitors you want to notify.
                </FormDescription>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </FormCardContent>
      </form>
    </Form>
  );
}
