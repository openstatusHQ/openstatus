import { Shell } from "@/components/dashboard/shell";
import NavigationLink from "./_components/navigation-link";
import { UserButton } from "./_components/user-button";
import { Switcher } from './_components/switcher';
import { getI18n } from '@/yuzu/server';

export default async function StatusPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const t = await getI18n();

  return (
    <div className="flex min-h-screen w-full flex-col space-y-6 p-4 md:p-8">
      <header className="mx-auto w-full max-w-xl">
        <Shell className="mx-auto flex items-center justify-center gap-2 p-2 px-2 md:p-3">
          <NavigationLink slug={null}>{t('Status')}</NavigationLink>
          <NavigationLink slug="incidents">{t('Incidents')}</NavigationLink>
        </Shell>
      </header>
      <main className="flex h-full w-full flex-1 flex-col">
        <Shell className="mx-auto h-full max-w-xl flex-1 px-4 py-4">
          {children}
        </Shell>
      </main>
      <footer className="z-10">
        <p className="text-muted-foreground text-center text-sm">
          {t('powered by')}{" "}
          <a
            href="https://www.openstatus.dev"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            openstatus.dev
          </a>
        </p>
        <Switcher />
      </footer>
    </div>
  );
}
