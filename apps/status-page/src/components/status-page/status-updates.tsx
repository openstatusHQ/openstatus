"use client";

import { FormSubscribeEmail } from "@/components/forms/form-subscribe-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { useState } from "react";

type StatusUpdateType = "email" | "rss" | "atom";

interface StatusUpdatesProps extends React.ComponentProps<typeof Button> {
  types?: StatusUpdateType[];
  onSubscribe?: (value: string) => Promise<void> | void;
}

export function StatusUpdates({
  className,
  types = ["rss", "atom"],
  onSubscribe,
  ...props
}: StatusUpdatesProps) {
  const [success, setSuccess] = useState(false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(className)}
          {...props}
        >
          Get updates
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="overflow-hidden p-0">
        <Tabs defaultValue="email">
          <TabsList className="w-full rounded-none border-b">
            {types.includes("email") ? (
              <TabsTrigger value="email">Email</TabsTrigger>
            ) : null}
            {types.includes("rss") ? (
              <TabsTrigger value="rss">RSS</TabsTrigger>
            ) : null}
            {types.includes("atom") ? (
              <TabsTrigger value="atom">Atom</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="email" className="flex flex-col gap-2">
            {success ? (
              <SuccessMessage />
            ) : (
              <>
                <div className="flex flex-col gap-2 border-b px-2 pb-2">
                  <p className="text-foreground text-sm">
                    Get email notifications whenever a report has been created
                    or resolved
                  </p>
                  <FormSubscribeEmail
                    id="email-form"
                    onSubmit={async (values) => {
                      try {
                        await onSubscribe?.(values.email);
                        setSuccess(true);
                      } catch (error) {
                        // NOTE: we throw the error to be handled by the toast
                        throw error;
                      }
                    }}
                  />
                </div>
                <div className="px-2 pb-2">
                  <Button className="w-full" type="submit" form="email-form">
                    Subscribe
                  </Button>
                </div>{" "}
              </>
            )}
          </TabsContent>
          <TabsContent value="rss" className="flex flex-col gap-2">
            <div className="border-b px-2 pb-2">
              <Input
                placeholder="https://status.openstatus.dev/feed/rss"
                className="disabled:opacity-90"
                disabled
              />
            </div>
            <div className="px-2 pb-2">
              <CopyButton
                className="w-full"
                value="https://status.openstatus.dev/feed/rss"
              />
            </div>
          </TabsContent>
          <TabsContent value="atom" className="flex flex-col gap-2">
            <div className="border-b px-2 pb-2">
              <Input
                placeholder="https://status.openstatus.dev/feed/atom"
                className="disabled:opacity-90"
                disabled
              />
            </div>
            <div className="px-2 pb-2">
              <CopyButton
                className="w-full"
                value="https://status.openstatus.dev/feed/atom"
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function CopyButton({
  value,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <Button
      size="sm"
      onClick={(e) => {
        copy(value, {});
        onClick?.(e);
      }}
      {...props}
    >
      {isCopied ? "Copied" : "Copy link"}
    </Button>
  );
}

function SuccessMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-3">
      <Inbox className="size-4 shrink-0" />
      <p className="text-center font-medium">Check your inbox!</p>
      <p className="text-center text-muted-foreground text-sm">
        Validate your email to receive updates and you are all set.
      </p>
    </div>
  );
}
