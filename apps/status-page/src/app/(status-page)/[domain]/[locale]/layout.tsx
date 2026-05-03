import { DateFnsProvider } from "@/components/date-fns-provider";
import { StatusBlocksProvider } from "@/components/i18n/status-blocks-provider";
import { routing } from "@/i18n/routing";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DateFnsProvider locale={locale}>
        <StatusBlocksProvider>{children}</StatusBlocksProvider>
      </DateFnsProvider>
    </NextIntlClientProvider>
  );
}
