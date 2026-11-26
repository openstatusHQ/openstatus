import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import type {
  ComponentDayBucket,
  ComponentEvent,
  CustomTheme,
  GetPageComponentDailySummaryResponse,
  PageComponentDailySummary,
  StatusPageService,
} from "@openstatus/proto/status_page/v1";
import {
  OverallStatus,
  PageAccessType,
} from "@openstatus/proto/status_page/v1";
import {
  ConflictError,
  InternalServiceError,
  NotFoundError,
  ServiceError,
  withTransaction,
} from "@openstatus/services";
import {
  createPage,
  deletePage,
  getPage,
  getPageBySlug,
  getPageOverallStatus,
  getPageRow,
  getStatusPageContent,
  type PageStatus,
  type StatusPageContent,
  listPages,
  parsePageConfiguration,
  updatePageAppearance,
  updatePageCustomDomain,
  updatePageCustomTheme,
  updatePageGeneral,
  updatePageLinks,
  updatePageLocales,
  updatePagePasswordProtection,
} from "@openstatus/services/page";
import {
  createPageComponent,
  deletePageComponent,
  getPageComponent,
  getPageComponentDailySummary,
  updatePageComponent,
} from "@openstatus/services/page-component";
import {
  createPageComponentGroup,
  deletePageComponentGroup,
  updatePageComponentGroup,
} from "@openstatus/services/page-component-group";
import {
  createPageSubscriber,
  countPageSubscribers,
  listPageSubscribers,
  unsubscribePageSubscriber,
  sendSubscriberVerification,
  subscribeEmailInWorkspace,
} from "@openstatus/services/page-subscriber";
import {
  THEME_KEYS,
  type ThemeKey,
  validateCustomTheme,
} from "@openstatus/theme-store";

import { rethrowPlanLimit, toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import { parseId } from "../../parse";
import { dbImpactToProto } from "../status-report/converters";
import {
  dayStatusToProto,
  dbComponentToProto,
  dbComponentTypeToProto,
  dbConfigurationToProto,
  dbGroupToProto,
  dbPageToProto,
  dbPageToProtoSummary,
  dbSubscriberToProto,
  eventStatusToProto,
  eventTypeToProto,
  protoAccessTypeToDb,
  protoHeadersToPlain,
  protoLocaleToDb,
  protoThemeToDb,
} from "./converters";
import {
  authEmailDomainsRequiredError,
  componentGroupNotFoundError,
  identifierRequiredError,
  invalidCustomDomainError,
  invalidIconUrlError,
  monitorNotFoundError,
  pageComponentNotFoundError,
  passwordRequiredError,
  slugAlreadyExistsError,
  statusPageAccessDeniedError,
  statusPageIdRequiredError,
  statusPageNotFoundError,
  statusPageNotPublishedError,
  subscriberCreateFailedError,
  subscriberNotFoundError,
} from "./errors";
import {
  checkCustomDomainLimit,
  checkCustomThemeLimit,
  checkEmailDomainProtectionLimit,
  checkIpRestrictionLimit,
  checkNoIndexLimit,
  checkPasswordProtectionLimit,
  checkStatusSubscribersLimit,
} from "./limits";

/**
 * Normalize a service `Page` back into the converter's raw-db shape.
 *
 * The service parses `authEmailDomains` / `allowedIpRanges` into arrays
 * via `selectPageSchema`; the converters expect the comma-joined string form
 * the DB stores.
 */
function serviceToConverterPage<
  P extends {
    authEmailDomains: string[];
    allowedIpRanges: string[];
  },
>(
  p: P,
): Omit<P, "authEmailDomains" | "allowedIpRanges"> & {
  authEmailDomains: string | null;
  allowedIpRanges: string | null;
} {
  return {
    ...p,
    authEmailDomains:
      p.authEmailDomains.length > 0 ? p.authEmailDomains.join(",") : null,
    allowedIpRanges:
      p.allowedIpRanges.length > 0 ? p.allowedIpRanges.join(",") : null,
  };
}

function parseEntityId(value: string, label: string): number {
  return parseId(
    value,
    () =>
      new ConnectError(`Invalid ${label}: "${value}"`, Code.InvalidArgument),
  );
}

/**
 * Validates public access to a status page.
 * Checks that the page is published and has public access type.
 * Throws appropriate errors if access is denied.
 */
function validatePublicAccess(
  pageData: { published: boolean | null; accessType: string | null },
  slug: string,
): void {
  // Check if page is published
  if (!pageData.published) {
    throw statusPageNotPublishedError(slug);
  }

  // Check access type - only public pages are accessible without authentication
  if (pageData.accessType && pageData.accessType !== "public") {
    throw statusPageAccessDeniedError(slug, pageData.accessType);
  }
}

function validateIconUrl(icon: string): void {
  let url: URL;
  try {
    url = new URL(icon);
  } catch {
    throw invalidIconUrlError();
  }
  if (url.protocol !== "https:") {
    throw invalidIconUrlError();
  }
}

function validateCustomDomain(domain: string): void {
  const lower = domain.toLowerCase();
  if (
    lower.includes("openstatus") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("www.")
  ) {
    throw invalidCustomDomainError(domain);
  }
}

function validateAuthEmailDomains(domains: string[]): string[] {
  const trimmed = domains.map((d) => d.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    throw authEmailDomainsRequiredError();
  }
  for (const domain of trimmed) {
    if (!domain.includes(".")) {
      throw new ConnectError(
        `Invalid email domain: "${domain}"`,
        Code.InvalidArgument,
      );
    }
  }
  return trimmed;
}

/**
 * Validate and normalize allowed IP ranges (comma-separated CIDR notation).
 * Appends /32 to bare IPs. Validates each entry is a valid IPv4 CIDR.
 */
function validateAllowedIpRanges(ranges: string): string[] {
  const entries = ranges
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new ConnectError(
      "At least one IP range is required for IP restriction",
      Code.InvalidArgument,
    );
  }
  const cidrRegex =
    /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)\/(3[0-2]|[12]?\d)$/;
  const normalized: string[] = [];
  for (const entry of entries) {
    const value = entry.includes("/") ? entry : `${entry}/32`;
    if (!cidrRegex.test(value)) {
      throw new ConnectError(
        `Invalid IPv4 CIDR range: "${entry}"`,
        Code.InvalidArgument,
      );
    }
    normalized.push(value);
  }
  return normalized;
}

// Proto map values arrive unvalidated; check var names / safe values at the
// handler so callers get a readable InvalidArgument instead of the service's
// raw zod message.
function validateProtoCustomTheme(customTheme: CustomTheme): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const input = {
    light: { ...customTheme.light },
    dark: { ...customTheme.dark },
  };
  const result = validateCustomTheme(input);
  if (!result.valid) {
    throw new ConnectError(result.errors.join(" "), Code.InvalidArgument);
  }
  return input;
}

type ResolvedPage = Awaited<ReturnType<typeof getPageRow>>;

async function getWorkspacePage(
  rpcCtx: ReturnType<typeof getRpcContext>,
  id: string,
): Promise<ResolvedPage> {
  try {
    return await getPageRow({
      ctx: toServiceCtx(rpcCtx),
      input: { id: parseEntityId(id, "page id") },
    });
  } catch (err) {
    if (err instanceof NotFoundError) throw statusPageNotFoundError(id);
    toConnectError(err);
  }
}

/** Group misses are reported as not-found whether absent or on another page. */
function rethrowGroupNotFound(err: unknown, groupId: string | undefined) {
  if (
    groupId &&
    err instanceof NotFoundError &&
    err.entity === "page_component_group"
  ) {
    throw componentGroupNotFoundError(groupId);
  }
}

async function fetchStatusPageContent(
  pageData: ResolvedPage,
  prefetched?: StatusPageContent,
) {
  const content =
    prefetched ?? (await getStatusPageContent({ pageId: pageData.id }));

  const { dbStatusToProto, dbUpdateToProto } =
    await import("../status-report/converters");

  const statusReports = content.statusReports.map((report) => ({
    $typeName: "openstatus.status_report.v1.StatusReport" as const,
    id: String(report.id),
    status: dbStatusToProto(report.status),
    title: report.title,
    pageComponentIds: report.pageComponentIds.map(String),
    updates: report.updates.map((u) =>
      dbUpdateToProto({ ...u, componentImpacts: u.componentImpacts }),
    ),
    createdAt: report.createdAt?.toISOString() ?? "",
    updatedAt: report.updatedAt?.toISOString() ?? "",
  }));

  const maintenancesProto = content.maintenances.map((m) => ({
    $typeName: "openstatus.maintenance.v1.MaintenanceSummary" as const,
    id: String(m.id),
    title: m.title,
    message: m.message,
    from: m.from.toISOString(),
    to: m.to.toISOString(),
    pageId: String(pageData.id),
    pageComponentIds: m.pageComponentIds.map(String),
    createdAt: m.createdAt?.toISOString() ?? "",
    updatedAt: m.updatedAt?.toISOString() ?? "",
  }));

  return {
    components: content.components.map(dbComponentToProto),
    groups: content.groups.map(dbGroupToProto),
    statusReports,
    maintenances: maintenancesProto,
  };
}

const pageStatusToProto: Record<PageStatus, OverallStatus> = {
  operational: OverallStatus.OPERATIONAL,
  degraded: OverallStatus.DEGRADED,
  maintenance: OverallStatus.MAINTENANCE,
};

async function computeOverallStatus(
  pageData: ResolvedPage,
  prefetched?: { id: number }[],
) {
  const result = await getPageOverallStatus({
    pageId: pageData.id,
    componentIds: prefetched?.map((c) => c.id),
  });
  return {
    overallStatus: pageStatusToProto[result.status],
    componentStatuses: result.components.map((c) => ({
      $typeName: "openstatus.status_page.v1.ComponentStatus" as const,
      componentId: String(c.id),
      status: pageStatusToProto[c.status],
    })),
  };
}

/**
 * Status page service implementation for ConnectRPC.
 */
export const statusPageServiceImpl: ServiceImpl<typeof StatusPageService> = {
  // ==========================================================================
  // Page CRUD
  // ==========================================================================
  //
  // Known gap (predates the services migration): both `createStatusPage`
  // and `updateStatusPage` accept and persist `customDomain`, but
  // neither calls the Vercel add/remove API the way the tRPC
  // `updateCustomDomain` procedure does. Clients setting a custom domain
  // via gRPC will get a db row that says the domain is set, but routing
  // won't actually work until a tRPC/dashboard round-trip picks up the
  // diff. The fix is to lift the Vercel sync (`addDomainToVercel` /
  // `removeDomainFromVercel`) into a shared transport-layer helper the
  // Connect handlers can reuse, kept out of the service layer. Tracked
  // as a follow-up; not landing here to avoid widening the behavioural
  // blast radius of the migration PR on external API consumers.

  async createStatusPage(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const sCtx = toServiceCtx(rpcCtx);
      const limits = rpcCtx.workspace.limits;

      // Slug uniqueness — preserved at handler to keep the granular
      // `slugAlreadyExistsError(slug)` (AlreadyExists + metadata) rather
      // than the service's generic ConflictError → InvalidArgument mapping.
      const existingPage = await getPageBySlug({ input: { slug: req.slug } });
      if (existingPage) {
        throw slugAlreadyExistsError(req.slug);
      }

      // i18n — keep at handler to preserve PermissionDenied over the
      // service's LimitExceededError → ResourceExhausted mapping.
      if (!limits.i18n) {
        if (req.defaultLocale !== undefined && req.defaultLocale !== 0) {
          throw new ConnectError(
            "Upgrade to configure locales.",
            Code.PermissionDenied,
          );
        }
        if (req.locales.length > 0) {
          throw new ConnectError(
            "Upgrade to configure locales.",
            Code.PermissionDenied,
          );
        }
      }

      const defaultLocale =
        req.defaultLocale !== undefined && req.defaultLocale !== 0
          ? protoLocaleToDb(req.defaultLocale)
          : "en";
      const validLocales = req.locales.filter((l) => l !== 0);
      const locales =
        validLocales.length > 0
          ? [...new Set(validLocales.map(protoLocaleToDb))]
          : null;
      if (locales && !locales.includes(defaultLocale)) {
        throw new ConnectError(
          "Default locale must be included in the locales list",
          Code.InvalidArgument,
        );
      }

      // Proto-specific format validations (regex / URL shape) — these
      // don't exist in the zod insert schema, so they stay at handler.
      const icon = req.icon ?? "";
      if (icon) validateIconUrl(icon);

      const customDomain = req.customDomain ?? "";
      if (customDomain) {
        checkCustomDomainLimit(limits);
        validateCustomDomain(customDomain);
      }

      const forceTheme =
        req.theme !== undefined && req.theme !== 0
          ? protoThemeToDb(req.theme)
          : "system";

      const reqAccessType = req.accessType;
      const hasAccessType = reqAccessType !== undefined && reqAccessType !== 0;
      const accessType = hasAccessType
        ? protoAccessTypeToDb(reqAccessType)
        : "public";

      let password: string | null = null;
      let authEmailDomains: string[] | undefined;
      let allowedIpRanges: string[] | undefined;

      if (hasAccessType) {
        if (reqAccessType === PageAccessType.PASSWORD_PROTECTED) {
          checkPasswordProtectionLimit(limits);
          const trimmedPassword = req.password?.trim() ?? "";
          if (!trimmedPassword) throw passwordRequiredError();
          password = trimmedPassword;
        } else if (reqAccessType === PageAccessType.AUTHENTICATED) {
          checkEmailDomainProtectionLimit(limits);
          authEmailDomains = validateAuthEmailDomains(req.authEmailDomains);
        } else if (reqAccessType === PageAccessType.IP_RESTRICTED) {
          checkIpRestrictionLimit(limits);
          allowedIpRanges = validateAllowedIpRanges(req.allowedIpRanges ?? "");
        }
      }

      const allowIndex = req.allowIndex ?? true;
      if (req.allowIndex !== undefined && !allowIndex) {
        checkNoIndexLimit(limits);
      }

      let customTheme: ReturnType<typeof validateProtoCustomTheme> | undefined;
      if (req.customTheme !== undefined) {
        checkCustomThemeLimit(limits);
        customTheme = validateProtoCustomTheme(req.customTheme);
      }

      // `published` relies on DB default (false). The service's
      // CreatePageInput type doesn't surface the column, and its behavior
      // matches the legacy `published: false` write on create.
      //
      // `workspaceId: sCtx.workspace.id` — `CreatePageInput` re-exports
      // the drizzle `insertPageSchema`, which requires `workspaceId` at
      // parse time. The service destructures it and uses
      // `ctx.workspace.id` on insert (so the input value is ignored),
      // but the zod parse fires first and rejects without the field.
      const created = await createPage({
        ctx: sCtx,
        input: {
          workspaceId: sCtx.workspace.id,
          title: req.title,
          description: req.description ?? "",
          slug: req.slug,
          customDomain,
          icon,
          forceTheme,
          accessType,
          password,
          authEmailDomains,
          allowedIpRanges,
          homepageUrl: req.homepageUrl ?? null,
          contactUrl: req.contactUrl ?? null,
          defaultLocale,
          locales,
          allowIndex,
          customTheme,
        },
      }).catch((err) =>
        rethrowPlanLimit(err, "status-pages", "Upgrade for more status pages."),
      );

      return { statusPage: dbPageToProto(serviceToConverterPage(created)) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getStatusPage(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const id = req.id?.trim();
      if (!id) throw statusPageIdRequiredError();

      try {
        const pageData = await getPage({
          ctx: toServiceCtx(rpcCtx),
          input: { id: parseEntityId(id, "page id") },
        });
        return {
          statusPage: dbPageToProto(serviceToConverterPage(pageData)),
        };
      } catch (err) {
        // Preserve the handler-specific `statusPageNotFoundError` (includes
        // page-id metadata header) over the service's generic NotFoundError.
        if (err instanceof NotFoundError) throw statusPageNotFoundError(id);
        throw err;
      }
    } catch (err) {
      toConnectError(err);
    }
  },

  async listStatusPages(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
      const offset = req.offset ?? 0;

      // Status-page quota is bounded per workspace (plan limit), so it's
      // fine to fetch all via the service and paginate in-memory rather
      // than expand the service's `ListPagesInput` shape for this migration.
      const all = await listPages({
        ctx: toServiceCtx(rpcCtx),
        input: { order: "desc" },
      });

      return {
        statusPages: all
          .slice(offset, offset + limit)
          .map((p) => dbPageToProtoSummary(serviceToConverterPage(p))),
        totalSize: all.length,
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updateStatusPage(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const sCtx = toServiceCtx(rpcCtx);
      const limits = rpcCtx.workspace.limits;

      const id = req.id?.trim();
      if (!id) throw statusPageIdRequiredError();
      const pageId = parseEntityId(id, "page id");

      // i18n — keep at handler to preserve PermissionDenied.
      if (!limits.i18n) {
        if (req.defaultLocale !== undefined && req.defaultLocale !== 0) {
          throw new ConnectError(
            "Upgrade to configure locales.",
            Code.PermissionDenied,
          );
        }
        if (req.locales.length > 0) {
          throw new ConnectError(
            "Upgrade to configure locales.",
            Code.PermissionDenied,
          );
        }
      }

      // Load existing via service so the rest of this handler orchestrates
      // per-section service calls against a consistent snapshot.
      let existing: Awaited<ReturnType<typeof getPage>>;
      try {
        existing = await getPage({ ctx: sCtx, input: { id: pageId } });
      } catch (err) {
        if (err instanceof NotFoundError) throw statusPageNotFoundError(id);
        throw err;
      }

      // Slug uniqueness — pre-check at handler to preserve the granular
      // `slugAlreadyExistsError(slug)` (AlreadyExists + metadata).
      if (req.slug && req.slug !== existing.slug) {
        const slugRow = await getPageBySlug({ input: { slug: req.slug } });
        if (slugRow && slugRow.id !== existing.id) {
          throw slugAlreadyExistsError(req.slug);
        }
      }

      // Access-type branch decides what the persisted auth fields become.
      const reqAccessType = req.accessType;
      const hasAccessType = reqAccessType !== undefined && reqAccessType !== 0;

      let nextAccessType = existing.accessType;
      let nextPassword: string | null = existing.password ?? null;
      let nextAuthEmailDomains: string[] | undefined =
        existing.authEmailDomains;
      let nextAllowedIpRanges: string[] | undefined = existing.allowedIpRanges;

      if (hasAccessType) {
        nextAccessType = protoAccessTypeToDb(reqAccessType);
        if (reqAccessType === PageAccessType.PASSWORD_PROTECTED) {
          checkPasswordProtectionLimit(limits);
          const trimmedPassword = req.password?.trim() ?? "";
          if (!trimmedPassword) throw passwordRequiredError();
          nextPassword = trimmedPassword;
          nextAuthEmailDomains = undefined;
          nextAllowedIpRanges = undefined;
        } else if (reqAccessType === PageAccessType.AUTHENTICATED) {
          checkEmailDomainProtectionLimit(limits);
          nextAuthEmailDomains = validateAuthEmailDomains(req.authEmailDomains);
          nextPassword = null;
          nextAllowedIpRanges = undefined;
        } else if (reqAccessType === PageAccessType.IP_RESTRICTED) {
          checkIpRestrictionLimit(limits);
          nextAllowedIpRanges = validateAllowedIpRanges(
            req.allowedIpRanges ?? "",
          );
          nextPassword = null;
          nextAuthEmailDomains = undefined;
        } else {
          // Switching to PUBLIC or other — clear stale auth data.
          nextPassword = null;
          nextAuthEmailDomains = undefined;
          nextAllowedIpRanges = undefined;
        }
      }

      const hasAllowIndex = req.allowIndex !== undefined;
      if (hasAllowIndex && !req.allowIndex) checkNoIndexLimit(limits);
      const nextAllowIndex = hasAllowIndex
        ? req.allowIndex
        : existing.allowIndex;

      if (req.customDomain !== undefined && req.customDomain) {
        checkCustomDomainLimit(limits);
        validateCustomDomain(req.customDomain);
      }
      if (req.icon !== undefined && req.icon) validateIconUrl(req.icon);

      // Locale merge + cross-field validation. `default_locale` is an enum and
      // `locales` is `repeated`, so an omitted field decodes to UNSPECIFIED /
      // `[]` — treat both as "not provided" and keep what is stored, or
      // updating a title would silently reset the page's languages. Same
      // presence test the theme / access-type fields below use. Trade-off:
      // locales can't be cleared over this RPC until the proto carries
      // explicit presence.
      const reqDefaultLocale =
        req.defaultLocale !== undefined && req.defaultLocale !== 0
          ? req.defaultLocale
          : undefined;
      const nextDefaultLocale =
        reqDefaultLocale !== undefined
          ? protoLocaleToDb(reqDefaultLocale)
          : existing.defaultLocale;
      const validLocales = req.locales.filter((l) => l !== 0);
      const nextLocales =
        validLocales.length > 0
          ? [...new Set(validLocales.map(protoLocaleToDb))]
          : existing.locales;
      if (nextLocales && !nextLocales.includes(nextDefaultLocale)) {
        throw new ConnectError(
          "Default locale must be included in the locales list",
          Code.InvalidArgument,
        );
      }
      const localesChanged =
        limits.i18n === true &&
        (reqDefaultLocale !== undefined || validLocales.length > 0);

      const generalChanged =
        (req.title !== undefined && req.title !== "") ||
        req.description !== undefined ||
        (req.slug !== undefined && req.slug !== "") ||
        req.icon !== undefined;

      const linksChanged =
        req.homepageUrl !== undefined || req.contactUrl !== undefined;

      // Snapshot the narrowed primitives so TS retains their non-undefined
      // types inside the transaction closure below.
      const themeForUpdate =
        req.theme !== undefined && req.theme !== 0 ? req.theme : undefined;
      const customDomainForUpdate =
        req.customDomain !== undefined ? req.customDomain : undefined;
      const accessChanged = hasAccessType || hasAllowIndex;

      // Omitted = keep; empty message = clear (the service maps an empty
      // var set to null).
      let customThemeForUpdate:
        | ReturnType<typeof validateProtoCustomTheme>
        | undefined;
      if (req.customTheme !== undefined) {
        checkCustomThemeLimit(limits);
        customThemeForUpdate = validateProtoCustomTheme(req.customTheme);
      }

      // Wrap all per-section updates in a single transaction so partial
      // failures don't leave the page in a half-updated state. Each
      // per-section service call's internal `withTransaction` detects
      // the pre-opened tx and skips nesting.
      await withTransaction(sCtx, async (tx) => {
        const txCtx = { ...sCtx, db: tx };

        if (generalChanged) {
          try {
            await updatePageGeneral({
              ctx: txCtx,
              input: {
                id: pageId,
                title:
                  req.title !== undefined && req.title !== ""
                    ? req.title
                    : existing.title,
                slug:
                  req.slug !== undefined && req.slug !== ""
                    ? req.slug
                    : existing.slug,
                description:
                  req.description !== undefined
                    ? req.description
                    : existing.description,
                icon: req.icon !== undefined ? req.icon : existing.icon,
              },
            });
          } catch (err) {
            // Close the slug-race gap: if two callers both cleared the
            // handler's pre-check and the loser's `assertSlugAvailable`
            // inside the service throws `ConflictError`, the default
            // mapping surfaces as `Code.InvalidArgument`. Rethrow as the
            // granular `slugAlreadyExistsError` so gRPC clients keying on
            // `Code.AlreadyExists` get a consistent code whether they
            // lose at the pre-check or at the inner transaction.
            if (err instanceof ConflictError && req.slug) {
              throw slugAlreadyExistsError(req.slug);
            }
            throw err;
          }
        }

        if (linksChanged) {
          await updatePageLinks({
            ctx: txCtx,
            input: {
              id: pageId,
              homepageUrl:
                req.homepageUrl !== undefined
                  ? req.homepageUrl || null
                  : existing.homepageUrl,
              contactUrl:
                req.contactUrl !== undefined
                  ? req.contactUrl || null
                  : existing.contactUrl,
            },
          });
        }

        if (themeForUpdate !== undefined) {
          const existingConfig =
            typeof existing.configuration === "object" &&
            existing.configuration !== null
              ? (existing.configuration as Record<string, unknown>)
              : {};
          // `theme` is typed on the service input as a `THEME_KEYS`
          // enum member. The existing column may carry any string (or
          // be missing) from pre-enforcement writes; fall back to
          // `"default"` for unknown values rather than forwarding them
          // through to the tighter service input. Use the canonical
          // `THEME_KEYS` so a new theme added to `@openstatus/theme-
          // store` stays accepted here without a manual copy.
          const existingTheme: ThemeKey =
            typeof existingConfig.theme === "string" &&
            (THEME_KEYS as ReadonlyArray<string>).includes(existingConfig.theme)
              ? (existingConfig.theme as ThemeKey)
              : "default";
          await updatePageAppearance({
            ctx: txCtx,
            input: {
              id: pageId,
              forceTheme: protoThemeToDb(themeForUpdate),
              configuration: { theme: existingTheme },
            },
          });
        }

        if (customDomainForUpdate !== undefined) {
          await updatePageCustomDomain({
            ctx: txCtx,
            input: { id: pageId, customDomain: customDomainForUpdate },
          });
        }

        if (customThemeForUpdate !== undefined) {
          await updatePageCustomTheme({
            ctx: txCtx,
            input: { id: pageId, customTheme: customThemeForUpdate },
          });
        }

        if (localesChanged) {
          await updatePageLocales({
            ctx: txCtx,
            input: {
              id: pageId,
              defaultLocale: nextDefaultLocale,
              locales: nextLocales,
            },
          });
        }

        if (accessChanged) {
          await updatePagePasswordProtection({
            ctx: txCtx,
            input: {
              id: pageId,
              accessType: nextAccessType,
              authEmailDomains: nextAuthEmailDomains,
              password: nextPassword,
              allowedIpRanges: nextAllowedIpRanges,
              allowIndex: nextAllowIndex,
            },
          });
        }
      });

      const updated = await getPage({ ctx: sCtx, input: { id: pageId } });
      return { statusPage: dbPageToProto(serviceToConverterPage(updated)) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async deleteStatusPage(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const id = req.id?.trim();
      if (!id) throw statusPageIdRequiredError();

      try {
        await deletePage({
          ctx: toServiceCtx(rpcCtx),
          input: { id: parseEntityId(id, "page id") },
        });
      } catch (err) {
        if (err instanceof NotFoundError) throw statusPageNotFoundError(id);
        throw err;
      }

      return { success: true };
    } catch (err) {
      toConnectError(err);
    }
  },

  // ==========================================================================
  // Component Management
  // ==========================================================================

  async addMonitorComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const pageData = await getWorkspacePage(rpcCtx, req.pageId);
    const monitorId = parseEntityId(req.monitorId, "monitor id");
    const groupId = req.groupId ? parseEntityId(req.groupId, "group id") : null;

    try {
      const created = await createPageComponent({
        ctx: toServiceCtx(rpcCtx),
        input: {
          pageId: pageData.id,
          type: "monitor",
          monitorId,
          name: req.name,
          description: req.description ?? null,
          order: req.order ?? 0,
          groupId,
          public: req.public,
        },
      });

      return { component: dbComponentToProto(created) };
    } catch (err) {
      if (err instanceof NotFoundError && err.entity === "monitor") {
        throw monitorNotFoundError(req.monitorId);
      }
      rethrowGroupNotFound(err, req.groupId);
      rethrowPlanLimit(
        err,
        "page-components",
        "Upgrade for more page components",
      );
    }
  },

  async addStaticComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const pageData = await getWorkspacePage(rpcCtx, req.pageId);
    const groupId = req.groupId ? parseEntityId(req.groupId, "group id") : null;

    try {
      const created = await createPageComponent({
        ctx: toServiceCtx(rpcCtx),
        input: {
          pageId: pageData.id,
          type: "static",
          monitorId: null,
          name: req.name,
          description: req.description ?? null,
          order: req.order ?? 0,
          groupId,
        },
      });

      return { component: dbComponentToProto(created) };
    } catch (err) {
      rethrowGroupNotFound(err, req.groupId);
      rethrowPlanLimit(
        err,
        "page-components",
        "Upgrade for more page components",
      );
    }
  },

  async removeComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const sCtx = toServiceCtx(rpcCtx);

    const id = req.id?.trim();
    if (!id) {
      throw pageComponentNotFoundError(req.id);
    }

    try {
      await deletePageComponent({
        ctx: sCtx,
        input: { id: parseEntityId(id, "component id") },
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw pageComponentNotFoundError(id);
      }
      toConnectError(err);
    }

    return { success: true };
  },

  async updateComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);

    const id = req.id?.trim();
    if (!id) {
      throw pageComponentNotFoundError(req.id);
    }

    try {
      const updated = await updatePageComponent({
        ctx: toServiceCtx(rpcCtx),
        input: {
          id: parseEntityId(id, "component id"),
          name:
            req.name !== undefined && req.name !== "" ? req.name : undefined,
          description:
            req.description !== undefined ? req.description || null : undefined,
          order: req.order,
          // Empty string means remove from group
          groupId:
            req.groupId !== undefined
              ? req.groupId === ""
                ? null
                : parseEntityId(req.groupId, "group id")
              : undefined,
          groupOrder: req.groupOrder,
          public: req.public,
        },
      });

      return { component: dbComponentToProto(updated) };
    } catch (err) {
      if (err instanceof NotFoundError && err.entity === "page_component") {
        throw pageComponentNotFoundError(id);
      }
      rethrowGroupNotFound(err, req.groupId);
      toConnectError(err);
    }
  },

  async getPageComponent(req, ctx) {
    const id = req.id?.trim();
    if (!id) throw pageComponentNotFoundError(req.id);
    try {
      const rpcCtx = getRpcContext(ctx);
      const component = await getPageComponent({
        ctx: toServiceCtx(rpcCtx),
        input: { id: parseEntityId(id, "component id") },
      });

      return { component: dbComponentToProto(component) };
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw pageComponentNotFoundError(id);
      }
      toConnectError(err);
    }
  },

  // ==========================================================================
  // Component Groups
  // ==========================================================================

  async createComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const pageData = await getWorkspacePage(rpcCtx, req.pageId);

    try {
      const created = await createPageComponentGroup({
        ctx: toServiceCtx(rpcCtx),
        input: {
          pageId: pageData.id,
          name: req.name,
          defaultOpen: req.defaultOpen ?? false,
        },
      });

      return { group: dbGroupToProto(created) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async deleteComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);

    const id = req.id?.trim();
    if (!id) {
      throw componentGroupNotFoundError(req.id);
    }

    try {
      await deletePageComponentGroup({
        ctx: toServiceCtx(rpcCtx),
        input: { id: parseEntityId(id, "group id") },
      });
    } catch (err) {
      rethrowGroupNotFound(err, id);
      toConnectError(err);
    }

    return { success: true };
  },

  async updateComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);

    const id = req.id?.trim();
    if (!id) {
      throw componentGroupNotFoundError(req.id);
    }

    try {
      const updated = await updatePageComponentGroup({
        ctx: toServiceCtx(rpcCtx),
        input: {
          id: parseEntityId(id, "group id"),
          name:
            req.name !== undefined && req.name !== "" ? req.name : undefined,
          defaultOpen: req.defaultOpen,
        },
      });

      return { group: dbGroupToProto(updated) };
    } catch (err) {
      rethrowGroupNotFound(err, id);
      toConnectError(err);
    }
  },

  // ==========================================================================
  // Subscribers
  // ==========================================================================

  async subscribeToPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    checkStatusSubscribersLimit(rpcCtx.workspace.limits);

    let result: Awaited<ReturnType<typeof subscribeEmailInWorkspace>>;
    try {
      result = await subscribeEmailInWorkspace({
        ctx: toServiceCtx(rpcCtx),
        input: {
          email: req.email,
          pageId: parseEntityId(req.pageId, "page id"),
        },
      });
    } catch (err) {
      if (err instanceof NotFoundError && err.entity === "page") {
        throw statusPageNotFoundError(req.pageId);
      }
      if (err instanceof InternalServiceError) {
        throw subscriberCreateFailedError();
      }
      toConnectError(err);
    }
    const { subscriber, row } = result;

    try {
      await sendSubscriberVerification({ subscriber });
    } catch (err) {
      console.error("Failed to send verification email:", err);
    }

    return {
      subscriber: dbSubscriberToProto(row),
    };
  },

  async createPageSubscription(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const sCtx = toServiceCtx(rpcCtx);

    const pageId = parseEntityId(req.pageId, "page id");
    const componentIds = (req.componentIds ?? []).map((id) =>
      parseEntityId(id, "component id"),
    );
    const name = req.name ?? null;

    if (
      req.channel.case !== "emailChannel" &&
      req.channel.case !== "webhookChannel"
    ) {
      throw new ConnectError(
        "channel oneof must be set to email_channel or webhook_channel",
        Code.InvalidArgument,
      );
    }

    let result: Awaited<ReturnType<typeof createPageSubscriber>>;
    try {
      if (req.channel.case === "emailChannel") {
        result = await createPageSubscriber({
          ctx: sCtx,
          input: {
            pageId,
            channelType: "email",
            email: req.channel.value.email,
            name,
            componentIds,
          },
        });
      } else {
        result = await createPageSubscriber({
          ctx: sCtx,
          input: {
            pageId,
            channelType: "webhook",
            webhookUrl: req.channel.value.webhookUrl,
            name,
            headers: protoHeadersToPlain(req.channel.value.headers),
            componentIds,
          },
        });
      }
    } catch (error) {
      if (error instanceof ConnectError) throw error;
      // Service-layer ServiceErrors map cleanly via toConnectError
      // (NotFound → NotFound, Conflict/Validation → InvalidArgument,
      // Forbidden → PermissionDenied, etc). Anything else surfaces as
      // Internal — don't echo raw messages to RPC clients.
      if (error instanceof ServiceError) {
        toConnectError(error);
      }
      console.error("createPageSubscription failed:", error);
      throw subscriberCreateFailedError();
    }

    return {
      subscriber: dbSubscriberToProto({
        ...result.row,
        componentIds: result.componentIds,
      }),
    };
  },

  async unsubscribeFromPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const pageId = parseEntityId(req.pageId, "page id");

    if (req.identifier.case !== "email" && req.identifier.case !== "id") {
      throw identifierRequiredError();
    }

    const identifier =
      req.identifier.case === "email"
        ? { type: "email" as const, value: req.identifier.value }
        : {
            type: "id" as const,
            value: parseEntityId(req.identifier.value, "subscriber id"),
          };

    try {
      await unsubscribePageSubscriber({
        ctx: toServiceCtx(rpcCtx),
        input: { pageId, identifier },
      });
    } catch (err) {
      if (err instanceof NotFoundError && err.entity === "page") {
        throw statusPageNotFoundError(req.pageId);
      }
      if (err instanceof NotFoundError) {
        throw subscriberNotFoundError(req.identifier.value);
      }
      toConnectError(err);
    }

    return { success: true };
  },

  async listSubscribers(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    try {
      const sCtx = toServiceCtx(rpcCtx);
      const filter = {
        pageId: parseEntityId(req.pageId, "page id"),
        includeUnsubscribed: req.includeUnsubscribed ?? false,
      };
      const [rows, totalSize] = await Promise.all([
        listPageSubscribers({ ctx: sCtx, input: { ...filter, limit, offset } }),
        countPageSubscribers({ ctx: sCtx, input: filter }),
      ]);

      return {
        subscribers: rows.map((row) =>
          dbSubscriberToProto({
            ...row,
            updatedAt: row.updatedAt ?? null,
            componentIds: row.components.map((c) => c.id),
          }),
        ),
        totalSize,
      };
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw statusPageNotFoundError(req.pageId);
      }
      toConnectError(err);
    }
  },

  // ==========================================================================
  // Full Content & Status
  // ==========================================================================

  async getStatusPageContent(req, ctx) {
    // Note: This endpoint may be used publicly, so we need to handle
    // the case where we look up by slug without workspace scope
    let pageData: ResolvedPage | undefined;
    let identifierValue: string;
    let isPublicAccess = false;

    if (req.identifier.case === "id") {
      identifierValue = req.identifier.value;
      pageData = await getWorkspacePage(getRpcContext(ctx), identifierValue);
    } else if (req.identifier.case === "slug") {
      identifierValue = req.identifier.value;
      pageData = await getPageBySlug({ input: { slug: identifierValue } });
      isPublicAccess = true;
    } else {
      throw statusPageIdRequiredError();
    }

    if (!pageData) {
      throw statusPageNotFoundError(identifierValue);
    }

    // Access control differs based on how the page is accessed:
    // - By slug (public): Validates page is published and publicly accessible
    // - By ID (workspace): Allows workspace members to preview unpublished pages
    if (isPublicAccess) {
      validatePublicAccess(pageData, identifierValue);
    }

    const content = await fetchStatusPageContent(pageData);

    const statusPage = dbPageToProto(pageData);
    if (isPublicAccess) {
      statusPage.password = "";
      statusPage.authEmailDomains = [];
      statusPage.allowedIpRanges = "";
    }

    return {
      statusPage,
      ...content,
    };
  },

  async getOverallStatus(req, ctx) {
    let pageData: ResolvedPage | undefined;
    let identifierValue: string;
    let isPublicAccess = false;

    if (req.identifier.case === "id") {
      identifierValue = req.identifier.value;
      pageData = await getWorkspacePage(getRpcContext(ctx), identifierValue);
    } else if (req.identifier.case === "slug") {
      identifierValue = req.identifier.value;
      pageData = await getPageBySlug({ input: { slug: identifierValue } });
      isPublicAccess = true;
    } else {
      throw statusPageIdRequiredError();
    }

    if (!pageData) {
      throw statusPageNotFoundError(identifierValue);
    }

    // Access control differs based on how the page is accessed:
    // - By slug (public): Validates page is published and publicly accessible
    // - By ID (workspace): Allows workspace members to preview unpublished pages
    if (isPublicAccess) {
      validatePublicAccess(pageData, identifierValue);
    }

    return computeOverallStatus(pageData);
  },

  async getStatusPageOverview(req, ctx) {
    try {
      const rpcCtx = getRpcContext(ctx);
      const pageData = await getWorkspacePage(rpcCtx, req.id);
      const pageContent = await getStatusPageContent({ pageId: pageData.id });
      const [content, status] = await Promise.all([
        fetchStatusPageContent(pageData, pageContent),
        computeOverallStatus(pageData, pageContent.components),
      ]);

      return {
        statusPage: dbPageToProto(pageData),
        configuration: dbConfigurationToProto(
          parsePageConfiguration(pageData.configuration),
        ),
        ...content,
        overallStatus: status.overallStatus,
        componentStatuses: status.componentStatuses,
      };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getPageComponentDailySummary(req, ctx) {
    let pageData: ResolvedPage | undefined;
    const rpcCtx = getRpcContext(ctx);
    let identifierValue: string;
    let isPublicAccess = false;

    if (req.identifier.case === "id") {
      identifierValue = req.identifier.value;
      pageData = await getWorkspacePage(rpcCtx, identifierValue);
    } else if (req.identifier.case === "slug") {
      identifierValue = req.identifier.value;
      pageData = await getPageBySlug({ input: { slug: identifierValue } });
      isPublicAccess = true;
    } else {
      throw statusPageIdRequiredError();
    }

    if (!pageData) {
      throw statusPageNotFoundError(identifierValue);
    }
    if (isPublicAccess) {
      validatePublicAccess(pageData, identifierValue);
    }

    try {
      const result = await getPageComponentDailySummary({
        ctx: toServiceCtx(rpcCtx),
        input: {
          pageId: pageData.id,
          // scope to the resolved page's workspace, not the caller's — the slug
          // (public) path may target a page in another workspace
          workspaceId: pageData.workspaceId,
          componentIds:
            req.componentIds.length > 0
              ? req.componentIds.map(Number)
              : undefined,
          days: req.days,
        },
      });

      const components = result.components.map(
        (component): PageComponentDailySummary => ({
          $typeName: "openstatus.status_page.v1.PageComponentDailySummary",
          componentId: String(component.componentId),
          type: dbComponentTypeToProto(component.type),
          monitorId:
            component.monitorId != null
              ? String(component.monitorId)
              : undefined,
          name: component.name,
          buckets: component.buckets.map((bucket): ComponentDayBucket => ({
            $typeName: "openstatus.status_page.v1.ComponentDayBucket",
            day: bucket.day,
            count: BigInt(bucket.count),
            ok: BigInt(bucket.ok),
            degraded: BigInt(bucket.degraded),
            error: BigInt(bucket.error),
            status: dayStatusToProto(bucket.status),
            impact: bucket.impact ? dbImpactToProto(bucket.impact) : undefined,
          })),
          events: component.events.map((event): ComponentEvent => ({
            $typeName: "openstatus.status_page.v1.ComponentEvent",
            id: String(event.id),
            name: event.name,
            type: eventTypeToProto(event.type),
            status: eventStatusToProto(event.status),
            from: event.from.toISOString(),
            to: event.to ? event.to.toISOString() : undefined,
            impact: event.impact ? dbImpactToProto(event.impact) : undefined,
          })),
        }),
      );

      return {
        $typeName:
          "openstatus.status_page.v1.GetPageComponentDailySummaryResponse" as const,
        components,
      } satisfies GetPageComponentDailySummaryResponse;
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw statusPageNotFoundError(identifierValue);
      }
      toConnectError(err);
    }
  },
};
