import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstatus/ui/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export type SidebarMetadataItem = {
  label: string;
  value: React.ReactNode;
  isNested?: boolean;
};

export type SidebarMetadataListItem = {
  /** Stable React key + handle for `active` matching. */
  id: string | number;
  label: React.ReactNode;
  /** Trailing meta on the row (e.g. "2m ago"). */
  meta?: React.ReactNode;
  /** Optional small leading icon. */
  icon?: LucideIcon;
  /** Click target — renders as `next/link` when set. */
  href?: string;
  /** Marks this row as the current selection. */
  active?: boolean;
  /** Hover-revealed trailing button (delete / pin / …). */
  action?: {
    icon: LucideIcon;
    label: string;
    onClick: (e: React.MouseEvent) => void;
  };
};

/**
 * Metadata section in `SidebarRight`. Two shapes:
 *
 *  - `type: "table"` (default) — label/value rows, copy-on-tap. Used for
 *    "Configuration", "Notifications", etc. on the monitor sidebar.
 *  - `type: "list"` — clickable rows with optional active state, leading
 *    icon, trailing meta and a hover-revealed action. Used for
 *    list-style sidebars like the chat conversations picker.
 */
export type SidebarMetadataProps =
  | {
      label: string;
      type?: "table";
      items?: SidebarMetadataItem[];
    }
  | {
      label: string;
      type: "list";
      items?: SidebarMetadataListItem[];
    };

export function SidebarMetadata(props: SidebarMetadataProps) {
  const { label } = props;
  return (
    <SidebarGroup className="p-0">
      <Collapsible defaultOpen className="group/collapsible border-b">
        <SidebarGroupLabel
          asChild
          className="group/label h-9 w-full rounded-none text-sidebar-foreground text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <CollapsibleTrigger>
            {label}{" "}
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="border-t">
            {props.type === "list" ? (
              <SidebarMetadataList items={props.items ?? []} />
            ) : (
              <SidebarMetadataTable items={props.items ?? []} />
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

function SidebarMetadataTable({
  items,
}: {
  items: {
    label: string;
    value: React.ReactNode;
    isNested?: boolean;
    tooltip?: string;
  }[];
}) {
  return (
    <Table>
      <TableHeader className="sr-only">
        <TableRow>
          <TableHead className="w-26">Label</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.label}-${index}`}>
            <TableCell className="w-26 border-r text-muted-foreground">
              <div className="min-w-[90px] max-w-[90px] truncate">
                {item.isNested ? "└ " : ""}
                {item.label}
              </div>
            </TableCell>
            <SidebarMetadataTableCell className="max-w-0 truncate font-mono">
              {item.value}
            </SidebarMetadataTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SidebarMetadataList({ items }: { items: SidebarMetadataListItem[] }) {
  return (
    <SidebarMenu className="gap-0 p-1">
      {items.map((item) => {
        const inner = (
          <>
            {item.icon ? <item.icon className="size-3.5 shrink-0" /> : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.meta != null ? (
              <span className="ml-auto shrink-0 text-muted-foreground text-xs">
                {item.meta}
              </span>
            ) : null}
          </>
        );
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={item.active} size="sm">
              {item.href ? (
                <Link href={item.href}>{inner}</Link>
              ) : (
                <button type="button">{inner}</button>
              )}
            </SidebarMenuButton>
            {item.action ? (
              <SidebarMenuAction
                showOnHover
                title={item.action.label}
                onClick={(e) => {
                  // Don't let the click bubble to the row's link.
                  e.preventDefault();
                  e.stopPropagation();
                  item.action?.onClick(e);
                }}
              >
                <item.action.icon />
                <span className="sr-only">{item.action.label}</span>
              </SidebarMenuAction>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SidebarMetadataTableCell({
  className,
  ...props
}: React.ComponentProps<typeof TableCell>) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const { copy, isCopied } = useCopyToClipboard();
  const [open, setOpen] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [ref]);

  const handleClick = () => {
    if (typeof props.children === "string") {
      copy(props.children, { withToast: false, timeout: 1000 });
    }
  };

  React.useEffect(() => {
    if (isCopied) setOpen(true);
  }, [isCopied]);

  return (
    <TableCell
      {...props}
      ref={ref}
      className={cn(
        typeof props.children === "string" && "cursor-pointer",
        className,
      )}
      onClick={handleClick}
    >
      <TooltipProvider>
        {isTruncated || isCopied ? (
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
              // NOTE: all the prevent default events avoid the tooltip to hide and show again
              onClick={(event) => event.preventDefault()}
              onPointerDown={(event) => event.preventDefault()}
              asChild
            >
              <span className="block truncate">{props.children}</span>
            </TooltipTrigger>
            <TooltipContent
              onPointerDownOutside={(event) => event.preventDefault()}
              side="left"
            >
              {isCopied ? "Copied" : props.children}
            </TooltipContent>
          </Tooltip>
        ) : (
          props.children
        )}
      </TooltipProvider>
    </TableCell>
  );
}
