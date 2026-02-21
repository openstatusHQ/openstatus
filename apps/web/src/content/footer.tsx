import { Link } from "@/content/link";
import { ThemeToggle } from "@/content/theme-toggle";
import { footerLinks } from "@/data/content";
import { FooterStatus } from "./footer-status";

export function Footer() {
  return (
    <footer>
      <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 md:grid-cols-3 [&>div]:bg-background [&>div]:p-4">
        {footerLinks.map((section) => (
          <div key={section.label}>
            <p className="text-muted-foreground">{section.label}</p>
            <ul>
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block w-full truncate hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="grid gap-px border border-border border-t-0 bg-border sm:grid-cols-2 md:grid-cols-3 [&>*]:bg-background">
        <Link
          href="/cal"
          className="flex w-full items-center gap-2 p-4 hover:bg-muted"
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
