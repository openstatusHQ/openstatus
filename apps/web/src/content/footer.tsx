import { Link } from "@/content/link";
import { ThemeToggle } from "@/content/theme-toggle";
import { footerLinks } from "@/data/content";
import { CmdK } from "./cmdk";
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
                    className="block w-full hover:bg-muted"
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
        <div>
          <div className="flex items-center gap-px bg-border [&>*]:bg-background [&>*]:p-4 [&>*]:hover:bg-muted [&>*]:data-[active=true]:bg-muted">
            <Link
              href="/cal"
              className="w-full items-center gap-2 truncate hover:bg-muted"
            >
              Talk to the founders
            </Link>
            <CmdK />
          </div>
        </div>
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
