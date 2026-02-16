"use client";

import { Link } from "@/components/common/link";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { Input } from "@openstatus/ui/components/ui/input";
import type { UseFormReturn } from "react-hook-form";

interface TelegramManualInputProps {
  form: UseFormReturn<any>;
}

export function TelegramManualInput({ form }: TelegramManualInputProps) {
  return (
    <FormField
      control={form.control}
      name="data.chatId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Telegram Chat ID</FormLabel>
          <FormControl>
            <Input placeholder="1234567890" {...field} />
          </FormControl>
          <FormMessage />
          <FormDescription>
            Enter the Telegram chat ID to send notifications to.{" "}
            <Link
              href="https://docs.openstatus.dev/reference/notification/#telegram"
              rel="noreferrer"
              target="_blank"
            >
              Learn more
            </Link>
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
