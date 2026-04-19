import type { Locale } from "@openstatus/locales";
import type {
  PageComponent,
  PageComponentGroup,
  PageSubscriber,
  StatusPage,
  StatusPageSummary,
  WebhookChannelHeader,
} from "@openstatus/proto/status_page/v1";
import {
  OverallStatus,
  PageAccessType,
  PageComponentType,
  PageTheme,
  Locale as ProtoLocale,
  SubscriberSource,
} from "@openstatus/proto/status_page/v1";

/**
 * Database types
 */
type DBPage = {
  id: number;
  title: string;
  description: string;
  slug: string;
  customDomain: string;
  published: boolean | null;
  forceTheme: "system" | "light" | "dark";
  accessType: "public" | "password" | "email-domain" | "ip-restriction" | null;
  homepageUrl: string | null;
  contactUrl: string | null;
  icon: string | null;
  password: string | null;
  authEmailDomains: string | null;
  allowedIpRanges: string | null;
  defaultLocale: Locale;
  locales: Locale[] | null;
  allowIndex: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type DBPageComponent = {
  id: number;
  pageId: number;
  name: string;
  description: string | null;
  type: "static" | "monitor";
  monitorId: number | null;
  order: number | null;
  groupId: number | null;
  groupOrder: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type DBPageComponentGroup = {
  id: number;
  pageId: number;
  name: string;
  defaultOpen: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type DBPageSubscriber = {
  id: number;
  pageId: number;
  email: string | null;
  acceptedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  source: "self_signup" | "vendor" | "import";
  name: string | null;
  channelType: "email" | "webhook";
  webhookUrl: string | null;
  channelConfig: string | null;
  componentIds?: number[];
};

/**
 * Convert DB access type string to proto enum.
 */
export function dbAccessTypeToProto(
  accessType: "public" | "password" | "email-domain" | "ip-restriction" | null,
): PageAccessType {
  switch (accessType) {
    case "public":
      return PageAccessType.PUBLIC;
    case "password":
      return PageAccessType.PASSWORD_PROTECTED;
    case "email-domain":
      return PageAccessType.AUTHENTICATED;
    case "ip-restriction":
      return PageAccessType.IP_RESTRICTED;
    default:
      return PageAccessType.PUBLIC;
  }
}

/**
 * Convert proto access type enum to DB string.
 */
export function protoAccessTypeToDb(
  accessType: PageAccessType,
): "public" | "password" | "email-domain" | "ip-restriction" {
  switch (accessType) {
    case PageAccessType.PUBLIC:
      return "public";
    case PageAccessType.PASSWORD_PROTECTED:
      return "password";
    case PageAccessType.AUTHENTICATED:
      return "email-domain";
    case PageAccessType.IP_RESTRICTED:
      return "ip-restriction";
    default:
      return "public";
  }
}

/**
 * Convert DB theme string to proto enum.
 */
export function dbThemeToProto(theme: "system" | "light" | "dark"): PageTheme {
  switch (theme) {
    case "system":
      return PageTheme.SYSTEM;
    case "light":
      return PageTheme.LIGHT;
    case "dark":
      return PageTheme.DARK;
    default:
      return PageTheme.SYSTEM;
  }
}

/**
 * Convert proto theme enum to DB string.
 */
export function protoThemeToDb(theme: PageTheme): "system" | "light" | "dark" {
  switch (theme) {
    case PageTheme.SYSTEM:
      return "system";
    case PageTheme.LIGHT:
      return "light";
    case PageTheme.DARK:
      return "dark";
    default:
      return "system";
  }
}

/**
 * Convert DB component type string to proto enum.
 */
export function dbComponentTypeToProto(
  type: "static" | "monitor",
): PageComponentType {
  switch (type) {
    case "monitor":
      return PageComponentType.MONITOR;
    case "static":
      return PageComponentType.STATIC;
    default:
      return PageComponentType.UNSPECIFIED;
  }
}

/**
 * Convert proto component type enum to DB string.
 */
export function protoComponentTypeToDb(
  type: PageComponentType,
): "static" | "monitor" {
  switch (type) {
    case PageComponentType.MONITOR:
      return "monitor";
    case PageComponentType.STATIC:
      return "static";
    default:
      return "static";
  }
}

/**
 * Convert DB locale string to proto enum.
 */
export function dbLocaleToProto(locale: Locale): ProtoLocale {
  switch (locale) {
    case "en":
      return ProtoLocale.EN;
    case "fr":
      return ProtoLocale.FR;
    case "de":
      return ProtoLocale.DE;
    default:
      return ProtoLocale.EN;
  }
}

/**
 * Convert proto locale enum to DB string.
 */
export function protoLocaleToDb(locale: ProtoLocale): Locale {
  switch (locale) {
    case ProtoLocale.EN:
      return "en";
    case ProtoLocale.FR:
      return "fr";
    case ProtoLocale.DE:
      return "de";
    default:
      return "en";
  }
}

/**
 * Convert a DB status page to full proto format.
 */
export function dbPageToProto(page: DBPage): StatusPage {
  return {
    $typeName: "openstatus.status_page.v1.StatusPage" as const,
    id: String(page.id),
    title: page.title,
    description: page.description,
    slug: page.slug,
    customDomain: page.customDomain ?? "",
    published: page.published ?? false,
    accessType: dbAccessTypeToProto(page.accessType),
    theme: dbThemeToProto(page.forceTheme),
    homepageUrl: page.homepageUrl ?? "",
    contactUrl: page.contactUrl ?? "",
    icon: page.icon ?? "",
    createdAt: page.createdAt?.toISOString() ?? "",
    updatedAt: page.updatedAt?.toISOString() ?? "",
    defaultLocale: dbLocaleToProto(page.defaultLocale),
    locales: page.locales?.map(dbLocaleToProto) ?? [],
    password: page.password ?? "",
    authEmailDomains: page.authEmailDomains?.split(",").filter(Boolean) ?? [],
    allowIndex: page.allowIndex ?? true,
    allowedIpRanges: page.allowedIpRanges ?? "",
  };
}

/**
 * Convert a DB status page to summary proto format.
 */
export function dbPageToProtoSummary(page: DBPage): StatusPageSummary {
  return {
    $typeName: "openstatus.status_page.v1.StatusPageSummary" as const,
    id: String(page.id),
    title: page.title,
    slug: page.slug,
    published: page.published ?? false,
    createdAt: page.createdAt?.toISOString() ?? "",
    updatedAt: page.updatedAt?.toISOString() ?? "",
    customDomain: page.customDomain ?? "",
  };
}

/**
 * Convert a DB page component to proto format.
 */
export function dbComponentToProto(component: DBPageComponent): PageComponent {
  return {
    $typeName: "openstatus.status_page.v1.PageComponent" as const,
    id: String(component.id),
    pageId: String(component.pageId),
    name: component.name,
    description: component.description ?? "",
    type: dbComponentTypeToProto(component.type),
    monitorId: component.monitorId != null ? String(component.monitorId) : "",
    order: component.order ?? 0,
    groupId: component.groupId != null ? String(component.groupId) : "",
    groupOrder: component.groupOrder ?? 0,
    createdAt: component.createdAt?.toISOString() ?? "",
    updatedAt: component.updatedAt?.toISOString() ?? "",
  };
}

/**
 * Convert a DB component group to proto format.
 */
export function dbGroupToProto(
  group: DBPageComponentGroup,
): PageComponentGroup {
  return {
    $typeName: "openstatus.status_page.v1.PageComponentGroup" as const,
    id: String(group.id),
    pageId: String(group.pageId),
    name: group.name,
    defaultOpen: group.defaultOpen ?? false,
    createdAt: group.createdAt?.toISOString() ?? "",
    updatedAt: group.updatedAt?.toISOString() ?? "",
  };
}

/**
 * Normalize proto WebhookChannelHeader[] into plain {key,value}[].
 *
 * Drops runtime-only fields like `$typeName` so nothing proto-specific
 * reaches the DB. Mirrors the pattern used by `headersToDbJson` in the
 * monitor converters (`monitor/converters/headers.ts`).
 */
export function protoHeadersToPlain(
  headers: WebhookChannelHeader[] | undefined,
): { key: string; value: string }[] {
  return (headers ?? []).map((h) => ({ key: h.key, value: h.value }));
}

/**
 * Convert a DB subscriber-source string to proto enum.
 */
export function dbSubscriberSourceToProto(
  source: "self_signup" | "vendor" | "import",
): SubscriberSource {
  switch (source) {
    case "self_signup":
      return SubscriberSource.SELF_SIGNUP;
    case "vendor":
      return SubscriberSource.VENDOR;
    case "import":
      return SubscriberSource.IMPORT;
    default:
      return SubscriberSource.UNSPECIFIED;
  }
}

/**
 * Convert a DB subscriber to proto format.
 */
export function dbSubscriberToProto(
  subscriber: DBPageSubscriber,
): PageSubscriber {
  return {
    $typeName: "openstatus.status_page.v1.PageSubscriber" as const,
    id: String(subscriber.id),
    pageId: String(subscriber.pageId),
    email: subscriber.email ?? "",
    acceptedAt: subscriber.acceptedAt?.toISOString() ?? "",
    unsubscribedAt: subscriber.unsubscribedAt?.toISOString() ?? "",
    createdAt: subscriber.createdAt?.toISOString() ?? "",
    updatedAt: subscriber.updatedAt?.toISOString() ?? "",
    source: dbSubscriberSourceToProto(subscriber.source),
    name: subscriber.name ?? undefined,
    channelType: subscriber.channelType,
    webhookUrl: subscriber.webhookUrl ?? undefined,
    channelConfig: subscriber.channelConfig ?? undefined,
    componentIds: (subscriber.componentIds ?? []).map(String),
  };
}

/**
 * Get overall status based on component statuses.
 * This is a placeholder - the actual implementation would look at
 * monitor statuses, active incidents, and maintenance windows.
 */
export function getOverallStatusValue(): OverallStatus {
  // Default to operational - in a real implementation this would
  // aggregate status from monitors and incidents
  return OverallStatus.OPERATIONAL;
}
