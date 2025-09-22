"use client";

import { FormSubscribeEmail } from "@/components/forms/form-subscribe-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Check, Copy, Inbox } from "lucide-react";
import { useState } from "react";

type StatusUpdateType = "email" | "rss" | "ssh";

// TODO: use domain instead of openstatus subdomain if available

interface StatusUpdatesProps extends React.ComponentProps<typeof Button> {
  types?: StatusUpdateType[];
  slug?: string;
  onSubscribe?: (value: string) => Promise<void> | void;
}

export function StatusUpdates({
  className,
  types = ["rss", "ssh"],
  slug,
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
      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <Tabs defaultValue="email">
          <TabsList className="w-full rounded-none border-b">
            {types.includes("email") ? (
              <TabsTrigger value="email">Email</TabsTrigger>
            ) : null}
            {types.includes("rss") ? (
              <TabsTrigger value="rss">RSS</TabsTrigger>
            ) : null}
            {types.includes("ssh") ? (
              <TabsTrigger value="ssh">SSH</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="email" className="flex flex-col gap-2">
            {success ? (
              <SuccessMessage />
            ) : (
              <>
                <div className="flex flex-col gap-2 border-b px-2 pb-2">
                  <p className="text-sm">
                    Get email notifications whenever a report has been created
                    or resolved
                  </p>
                  <FormSubscribeEmail
                    id="email-form"
                    onSubmit={async (values) => {
                      await onSubscribe?.(values.email);
                      setSuccess(true);
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
            <div className="flex flex-col gap-2 px-2">
              <p className="text-sm">Get the RSS feed</p>
              <CopyInputButton
                className="w-full"
                id="rss"
                value={`https://${slug}.openstatus.dev/feed/rss`}
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-2 px-2 pb-2">
              <p className="text-sm">Get the Atom feed</p>
              <CopyInputButton
                className="w-full"
                id="atom"
                value={`https://${slug}.openstatus.dev/feed/atom`}
              />
            </div>
          </TabsContent>
          <TabsContent value="ssh" className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 px-2 pb-2">
              <p className="text-sm">Get status via SSH</p>
              <CopyInputButton
                className="w-full"
                id="ssh"
                value={`ssh ${slug}@ssh.openstatus.dev`}
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function CopyInputButton({
  value,
  onClick,
  ...props
}: React.ComponentProps<typeof Input> & {
  value: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <div className="relative w-full">
      <Input
        placeholder={value}
        readOnly
        onClick={(e) => {
          copy(value, {
            successMessage: "Link copied to clipboard",
          });
          onClick?.(e);
        }}
        {...props}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() =>
          copy(value, {
            successMessage: "Link copied to clipboard",
          })
        }
        className="-translate-y-1/2 absolute top-1/2 right-2 size-6"
      >
        {isCopied ? <Check /> : <Copy />}
        <span className="sr-only">Copy Link</span>
      </Button>
    </div>
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
      {isCopied ? "Copied" : "Copy"}
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
