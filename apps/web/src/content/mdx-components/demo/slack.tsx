import type React from "react";

import { cn } from "@/lib/utils";

import type { Tone } from "./cell";

/** One Slack message: `SlackAvatar` in the gutter, `SlackMessageContent` beside it. */
export function SlackMessage({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-message"
      className={cn("grid grid-cols-[28px_minmax(0,1fr)] gap-x-3", className)}
      {...props}
    />
  );
}

export function SlackAvatar({
  variant = "user",
  className,
  ...props
}: React.ComponentProps<"div"> & { variant?: "user" | "app" }) {
  return (
    <div
      data-slot="slack-avatar"
      data-variant={variant}
      className={cn(
        "flex size-7 items-center justify-center text-[11px] font-semibold",
        variant === "app"
          ? "bg-foreground text-background"
          : "bg-muted text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function SlackMessageContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-message-content"
      className={cn("min-w-0 space-y-1", className)}
      {...props}
    />
  );
}

/** Author line: `SlackAuthor`, optional `SlackAppBadge`, `SlackTime`. */
export function SlackMessageMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-message-meta"
      className={cn("flex flex-wrap items-baseline gap-x-2", className)}
      {...props}
    />
  );
}

export function SlackAuthor({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="slack-author"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  );
}

export function SlackAppBadge({
  className,
  children = "APP",
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="slack-app-badge"
      className={cn(
        "bg-muted text-muted-foreground px-1 text-[10px]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function SlackTime({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="slack-time"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

export function SlackMessageBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-message-body"
      className={cn("text-foreground/80 text-pretty", className)}
      {...props}
    />
  );
}

const attachmentBorder: Record<Tone, string> = {
  success: "border-success",
  warning: "border-warning",
  destructive: "border-destructive",
  info: "border-info",
  muted: "border-border",
};

/** Block Kit attachment: colored left bar, stacked sections. */
export function SlackAttachment({
  tone = "muted",
  className,
  ...props
}: React.ComponentProps<"div"> & { tone?: Tone }) {
  return (
    <div
      data-slot="slack-attachment"
      data-tone={tone}
      className={cn(
        "space-y-3 border-l-2 pl-3",
        attachmentBorder[tone],
        className,
      )}
      {...props}
    />
  );
}

export function SlackAttachmentTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-attachment-title"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  );
}

/** Two-up field grid; each `SlackField` holds a `SlackFieldLabel` and a `SlackFieldValue`. */
export function SlackFields({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-fields"
      className={cn("grid grid-cols-2 gap-x-4 gap-y-2 text-xs", className)}
      {...props}
    />
  );
}

export function SlackField({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="slack-field" className={className} {...props} />;
}

export function SlackFieldLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="slack-field-label"
      className={cn("text-foreground font-medium", className)}
      {...props}
    />
  );
}

export function SlackFieldValue({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="slack-field-value" className={className} {...props} />;
}

/** Inline link or @mention. */
export function SlackLink({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="slack-link"
      className={cn("text-info", className)}
      {...props}
    />
  );
}

export function SlackCode({
  className,
  ...props
}: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="slack-code"
      className={cn("bg-muted text-warning px-1 py-0.5 text-xs", className)}
      {...props}
    />
  );
}
