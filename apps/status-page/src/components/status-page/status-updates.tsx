import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

export function StatusUpdates({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
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
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="rss">RSS</TabsTrigger>
            <TabsTrigger value="atom">Atom</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 border-b px-2 pb-2">
              <p className="text-foreground text-sm">
                Get email notifications whenever a report has been created or
                resolved
              </p>
              <Input placeholder="notify@me.com" />
            </div>
            <div className="px-2 pb-2">
              <Button className="w-full">Subscribe</Button>
            </div>
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
  className,
}: {
  value: string;
  className?: string;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  return (
    <Button size="sm" className={className} onClick={() => copy(value, {})}>
      {isCopied ? "Copied" : "Copy link"}
    </Button>
  );
}
