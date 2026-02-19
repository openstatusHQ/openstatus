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
import type { FormValues } from "../notifications/form-telegram";

interface TelegramManualInputProps {
  form: UseFormReturn<FormValues>;
  successMsg?: string;
  showDescription?: boolean;
}

export function TelegramManualInput({
  form,
  successMsg,
  showDescription = true,
}: TelegramManualInputProps) {
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
          {successMsg && (
            <div className="font-medium text-green-600 text-sm">
              {successMsg}
            </div>
          )}
          {showDescription && (
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
          )}
        </FormItem>
      )}
    />
  );
}
