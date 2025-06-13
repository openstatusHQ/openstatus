import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { X, CircleDashed, CircleCheck } from "lucide-react";
import { Link } from "@/components/common/link";

const items = [
  {
    title: "Create Monitor",
    checked: true,
    href: "/dashboard/monitors/create",
  },
  {
    title: "Create Status Page",
    checked: true,
    href: "/dashboard/status-pages/create",
  },
  { title: "Create Notifier", checked: false, href: "/dashboard/notifiers" },
];

export function NavChecklist() {
  return (
    <SidebarGroup className="rounded-lg border bg-background group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between pr-1">
        <span>Getting Started</span>
        <SidebarMenuAction className="relative top-0 right-0">
          <X className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem
            key={item.title}
            className="flex items-center gap-2 text-sm"
          >
            {item.checked ? (
              <>
                <CircleCheck className="text-success" size={12} />
                <span>{item.title}</span>
              </>
            ) : (
              <>
                <CircleDashed className="text-muted-foreground/50" size={12} />
                <Link href={item.href}>{item.title}</Link>
              </>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
