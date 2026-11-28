import { getLocaleDirection } from "@openstatus/locales";
import { DirectionProvider } from "@openstatus/ui/components/ui/direction";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DateFnsProvider } from "../../../../components/date-fns-provider";
import { DocumentDirection } from "../../../../components/document-direction";
import { StatusBlocksProvider } from "../../../../components/i18n/status-blocks-provider";
import { routing } from "../../../../i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = (await import(`../../../../../messages/${locale}.json`))
    .default;

  const dir = getLocaleDirection(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DateFnsProvider locale={locale}>
        <StatusBlocksProvider>
          {/* Set lang and dir before first paint; DocumentDirection keeps
              them in sync on client-side locale switches. */}
          <script
            // locale is validated above; dir comes from the locale registry
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(dir)};`,
            }}
          />
          <DocumentDirection lang={locale} dir={dir} />
          <DirectionProvider dir={dir}>
            <div lang={locale} dir={dir}>
              {children}
            </div>
          </DirectionProvider>
        </StatusBlocksProvider>
      </DateFnsProvider>
    </NextIntlClientProvider>
  );
}
