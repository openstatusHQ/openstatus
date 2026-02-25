import { Link } from "@/content/link";
import { ThemeToggle } from "@/content/theme-toggle";
import { footerLinks } from "@/data/content";

import { FooterStatus } from "./footer-status";

export function Footer() {
  return (
    <footer>
      <div className="border-border bg-border [&>div]:bg-background grid grid-cols-1 gap-px border sm:grid-cols-2 md:grid-cols-3 [&>div]:p-4">
        {footerLinks.map((section) => (
          <div key={section.label}>
            <p className="text-muted-foreground">{section.label}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted block w-full truncate"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-border bg-border [&>*]:bg-background grid gap-px border border-t-0 sm:grid-cols-2 md:grid-cols-3">
        <Link
          href="/cal"
          className="hover:bg-muted flex w-full items-center gap-2 p-4"
        >
          Talk to the founders
        </Link>
        <div>
          <FooterStatus />
        </div>
        <div className="sm:col-span-2 md:col-span-1">
          <ThemeToggle className="rounded-none" />
        </div>
      </div>
    </footer>
  );
}
