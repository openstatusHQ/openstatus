"use client";

import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { Check, Copy } from "lucide-react";

/**
 * StatusUpdates — popover root for "Get updates" controls.
 *
 * Flat exports. Compose `StatusUpdatesTrigger` + `StatusUpdatesContent` and
 * pick whichever channel children apply (`StatusUpdatesRss`,
 * `StatusUpdatesJson`, `StatusUpdatesSlack`, `StatusUpdatesSsh`, or your own
 * email form). The block does not enforce a tab structure — callers wrap
 * children with `Tabs` themselves if needed.
 */
export function StatusUpdates({
  children,
  ...props
}: React.ComponentProps<typeof Popover>) {
  return <Popover {...props}>{children}</Popover>;
}

export function StatusUpdatesTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const labels = useStatusBlocksLabels();
  return (
    <PopoverTrigger asChild>
      <Button
        data-slot="status-updates-trigger"
        size="sm"
        variant="outline"
        className={cn(className)}
        {...props}
      >
        {children ?? labels.subscribe}
      </Button>
    </PopoverTrigger>
  );
}

export function StatusUpdatesContent({
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot="status-updates-content"
      align="end"
      className={cn("w-80 overflow-hidden p-0", className)}
      {...props}
    />
  );
}

/**
 * StatusUpdatesSection — single channel description + content slot.
 * Use to compose custom channels; the built-in `StatusUpdatesRss`/`Json`/
 * `Slack`/`Ssh` children render this internally.
 */
export function StatusUpdatesSection({
  description,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  description?: React.ReactNode;
}) {
  return (
    <div
      data-slot="status-updates-section"
      className={cn("flex flex-col gap-2 px-2 py-2", className)}
      {...props}
    >
      {description ? <div className="text-sm">{description}</div> : null}
      {children}
    </div>
  );
}

export function StatusUpdatesCopyInput({
  value,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value"> & { value: string }) {
  const labels = useStatusBlocksLabels();
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <div
      data-slot="status-updates-copy-input"
      className={cn("relative w-full", className)}
    >
      <Input
        data-slot="status-updates-copy-input-field"
        value={value}
        readOnly
        onClick={(e) => {
          copy(value, {
            successMessage: labels.linkCopiedToClipboard,
            withToast: true,
          });
          onClick?.(e);
        }}
        {...props}
      />
      <Button
        data-slot="status-updates-copy-input-button"
        type="button"
        variant="outline"
        size="icon"
        onClick={() =>
          copy(value, {
            successMessage: labels.linkCopiedToClipboard,
            withToast: true,
          })
        }
        className="-translate-y-1/2 absolute top-1/2 right-2 size-6"
      >
        {isCopied ? <Check /> : <Copy />}
        <span className="sr-only">{labels.ariaCopyLink}</span>
      </Button>
    </div>
  );
}

export function StatusUpdatesRss({
  rssUrl,
  atomUrl,
}: {
  rssUrl: string;
  atomUrl?: string;
}) {
  const labels = useStatusBlocksLabels();
  return (
    <>
      <StatusUpdatesSection description={labels.subscribeRssDescription}>
        <StatusUpdatesCopyInput value={rssUrl} />
      </StatusUpdatesSection>
      {atomUrl ? (
        <>
          <Separator />
          <StatusUpdatesSection description={labels.subscribeAtomDescription}>
            <StatusUpdatesCopyInput value={atomUrl} />
          </StatusUpdatesSection>
        </>
      ) : null}
    </>
  );
}

export function StatusUpdatesJson({ url }: { url: string }) {
  const labels = useStatusBlocksLabels();
  return (
    <StatusUpdatesSection description={labels.subscribeJsonDescription}>
      <StatusUpdatesCopyInput value={url} />
    </StatusUpdatesSection>
  );
}

export function StatusUpdatesSlack({ rssUrl }: { rssUrl: string }) {
  const labels = useStatusBlocksLabels();
  return (
    <StatusUpdatesSection description={labels.subscribeSlackDescription}>
      <StatusUpdatesCopyInput value={`/feed subscribe ${rssUrl}`} />
    </StatusUpdatesSection>
  );
}

export function StatusUpdatesSsh({ command }: { command: string }) {
  const labels = useStatusBlocksLabels();
  return (
    <StatusUpdatesSection description={labels.subscribeSshDescription}>
      <StatusUpdatesCopyInput value={command} />
    </StatusUpdatesSection>
  );
}
