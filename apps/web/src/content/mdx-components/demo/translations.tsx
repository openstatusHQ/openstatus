"use client";

import {
  StatusBannerContainer,
  StatusBannerIcon,
  StatusBannerMessage,
} from "@openstatus/ui/components/blocks/status-banner";
import {
  StatusComponent,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
} from "@openstatus/ui/components/blocks/status-component";
import {
  StatusBlocksI18nProvider,
  type StatusBlocksLabels,
} from "@openstatus/ui/components/blocks/status-i18n";
import { StatusLocaleSwitcher } from "@openstatus/ui/components/blocks/status-locale-switcher";
import { defaultStatusBlocksLabels } from "@openstatus/ui/components/blocks/status.utils";
import { useState } from "react";

import { demo } from "@/data/demo-data";

import { Cell, CellBody, CellHeader, CellTitle } from "./cell";

const options = demo.locales.map((l) => ({ value: l.code, label: l.name }));
// Open on a translated page, not the English default the reader already knows.
const DEFAULT_LOCALE = "fr";

function labelsFor(code: string): StatusBlocksLabels {
  const locale = demo.locales.find((l) => l.code === code) ?? demo.locales[0];
  return {
    ...defaultStatusBlocksLabels,
    systemStatus: {
      ...defaultStatusBlocksLabels.systemStatus,
      ...locale.systemStatus,
    },
  };
}

/** The same blocks, read through the i18n provider the status page mounts. */
export function TranslationsDemo() {
  const [locale, setLocale] = useState<string>(DEFAULT_LOCALE);
  const components = demo.components.filter((c) => !c.external).slice(0, 3);
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{demo.company.domain}</CellTitle>
        <StatusLocaleSwitcher
          value={locale}
          onValueChange={setLocale}
          locales={options}
          className="-my-1 size-7"
        />
      </CellHeader>
      <StatusBlocksI18nProvider value={labelsFor(locale)}>
        <CellBody className="flex flex-col gap-4">
          <StatusBannerContainer
            status="degraded"
            className="flex items-center gap-3 px-3 py-2"
          >
            <StatusBannerIcon className="shrink-0" />
            <StatusBannerMessage className="font-semibold" />
          </StatusBannerContainer>
          {components.map((c) => (
            <StatusComponent key={c.name} variant={c.status}>
              <StatusComponentHeader>
                <StatusComponentHeaderLeft>
                  <StatusComponentIcon />
                  <StatusComponentTitle>{c.name}</StatusComponentTitle>
                </StatusComponentHeaderLeft>
                <StatusComponentHeaderRight>
                  <StatusComponentStatus />
                </StatusComponentHeaderRight>
              </StatusComponentHeader>
            </StatusComponent>
          ))}
        </CellBody>
      </StatusBlocksI18nProvider>
    </Cell>
  );
}
