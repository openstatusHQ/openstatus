import { I18nProviderClient } from '@/yuzu/client';

export default async function StatusPageI18nLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProviderClient>
      {children}
    </I18nProviderClient>
  );
}