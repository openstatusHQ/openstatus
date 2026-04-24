import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import {
  and,
  count,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { StatusPageService } from "@openstatus/proto/status_page/v1";
import {
  OverallStatus,
  PageAccessType,
} from "@openstatus/proto/status_page/v1";
import {
  ConflictError,
  LimitExceededError,
  NotFoundError,
  withTransaction,
} from "@openstatus/services";
import {
  createPage,
  deletePage,
  getPage,
  listPages,
  updatePageAppearance,
  updatePageCustomDomain,
  updatePageGeneral,
  updatePageLinks,
  updatePageLocales,
  updatePagePasswordProtection,
} from "@openstatus/services/page";
import {
  createSubscription as createSubscriptionService,
  detectWebhookFlavor,
  getChannel,
  upsertEmailSubscription,
} from "@openstatus/subscriptions";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import {
  type DBPageSubscriber,
  dbComponentToProto,
  dbGroupToProto,
  dbPageToProto,
  dbPageToProtoSummary,
  dbSubscriberToProto,
  protoAccessTypeToDb,
  protoHeadersToPlain,
  protoLocaleToDb,
  protoThemeToDb,
} from "./converters";
import {
  authEmailDomainsRequiredError,
  componentGroupCreateFailedError,
  componentGroupNotFoundError,
  componentGroupUpdateFailedError,
  identifierRequiredError,
  invalidCustomDomainError,
  invalidIconUrlError,
  monitorNotFoundError,
  pageComponentCreateFailedError,
  pageComponentNotFoundError,
  pageComponentUpdateFailedError,
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
  checkEmailDomainProtectionLimit,
  checkIpRestrictionLimit,
  checkNoIndexLimit,
  checkPageComponentLimits,
  checkPasswordProtectionLimit,
  checkStatusSubscribersLimit,
} from "./limits";

/**
 * Normalize a service `Page` back into the converter's raw-db shape.
 *
 * The service parses `authEmailDomains` / `allowedIpRanges` into arrays
 * via `selectPageSchema`; the converters (shared with the 13 still-on-db
 * methods below) expect the comma-joined string form the DB stores.
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

/**
 * Helper to get a status page by ID with workspace scope.
 */
async function getPageById(id: number, workspaceId: number) {
  return db
    .select()
    .from(page)
    .where(and(eq(page.id, id), eq(page.workspaceId, workspaceId)))
    .get();
}

/**
 * Helper to get a status page by slug.
 * Normalizes the slug to lowercase before querying.
 */
async function getPageBySlug(slug: string) {
  const normalizedSlug = slug.toLowerCase();
  return db.select().from(page).where(eq(page.slug, normalizedSlug)).get();
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

/**
 * Helper to get a component by ID with workspace scope.
 */
async function getComponentById(id: number, workspaceId: number) {
  return db
    .select()
    .from(pageComponent)
    .where(
      and(eq(pageComponent.id, id), eq(pageComponent.workspaceId, workspaceId)),
    )
    .get();
}

/**
 * Helper to get a component group by ID with workspace scope.
 */
async function getGroupById(id: number, workspaceId: number) {
  return db
    .select()
    .from(pageComponentGroup)
    .where(
      and(
        eq(pageComponentGroup.id, id),
        eq(pageComponentGroup.workspaceId, workspaceId),
      ),
    )
    .get();
}

/**
 * Helper to get a monitor by ID with workspace scope.
 */
async function getMonitorById(id: number, workspaceId: number) {
  return db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.workspaceId, workspaceId)))
    .get();
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
      const existingPage = await getPageBySlug(req.slug);
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
        },
      }).catch((err) => {
        // Same handler-layer remap as the `i18n` pre-check above —
        // preserve `PermissionDenied` (403) for "plan quota reached"
        // on `status-pages`. The service throws `LimitExceededError`
        // which the Connect adapter maps to `ResourceExhausted`
        // (429), but the gRPC contract here is 403 for "upgrade
        // required".
        if (
          err instanceof LimitExceededError &&
          err.message.startsWith("status-pages")
        ) {
          throw new ConnectError(
            "Upgrade for more status pages.",
            Code.PermissionDenied,
          );
        }
        throw err;
      });

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
          input: { id: Number(id) },
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
      const pageId = Number(id);

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
        const slugRow = await getPageBySlug(req.slug);
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

      // Locale merge + cross-field validation.
      const nextDefaultLocale =
        req.defaultLocale !== undefined
          ? protoLocaleToDb(req.defaultLocale)
          : existing.defaultLocale;
      const validLocales = req.locales.filter((l) => l !== 0);
      const nextLocales =
        validLocales.length > 0
          ? [...new Set(validLocales.map(protoLocaleToDb))]
          : null;
      if (nextLocales && !nextLocales.includes(nextDefaultLocale)) {
        throw new ConnectError(
          "Default locale must be included in the locales list",
          Code.InvalidArgument,
        );
      }
      // `UpdateStatusPage` syncs locales on every call when the
      // workspace has i18n — proto can't distinguish "field omitted"
      // from "field = []", so the wire contract is "empty locales
      // means clear". Gating on `req.locales.length > 0` meant omit
      // and empty both became no-ops, leaving stale locales on the
      // page. Skip the call only on plans without i18n, where the
      // service would throw `LimitExceededError` regardless.
      const localesChanged = limits.i18n === true;

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
          // enum member. The existing column may have any string (or
          // be missing) from pre-enforcement writes; fall back to
          // `"default"` (a known enum member) rather than passing an
          // arbitrary string through.
          const VALID_THEMES = [
            "default",
            "default-rounded",
            "supabase",
            "github-contrast",
            "dracula",
          ] as const;
          type ValidTheme = (typeof VALID_THEMES)[number];
          const existingTheme: ValidTheme =
            typeof existingConfig.theme === "string" &&
            (VALID_THEMES as ReadonlyArray<string>).includes(
              existingConfig.theme,
            )
              ? (existingConfig.theme as ValidTheme)
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
          input: { id: Number(id) },
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
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Check workspace limits for page components
    await checkPageComponentLimits(pageData.id, limits);

    // Verify monitor exists and belongs to workspace
    const monitorData = await getMonitorById(
      Number(req.monitorId),
      workspaceId,
    );
    if (!monitorData) {
      throw monitorNotFoundError(req.monitorId);
    }

    // Validate group exists if provided
    if (req.groupId) {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Create the component
    const newComponent = await db
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId: pageData.id,
        type: "monitor",
        monitorId: monitorData.id,
        name: req.name ?? monitorData.name,
        description: req.description ?? null,
        order: req.order ?? 0,
        groupId: req.groupId ? Number(req.groupId) : null,
      })
      .returning()
      .get();

    if (!newComponent) {
      throw pageComponentCreateFailedError();
    }

    return {
      component: dbComponentToProto(newComponent),
    };
  },

  async addStaticComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Check workspace limits for page components
    await checkPageComponentLimits(pageData.id, limits);

    // Validate group exists if provided
    if (req.groupId) {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Create the component
    const newComponent = await db
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId: pageData.id,
        type: "static",
        monitorId: null,
        name: req.name,
        description: req.description ?? null,
        order: req.order ?? 0,
        groupId: req.groupId ? Number(req.groupId) : null,
      })
      .returning()
      .get();

    if (!newComponent) {
      throw pageComponentCreateFailedError();
    }

    return {
      component: dbComponentToProto(newComponent),
    };
  },

  async removeComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const id = req.id?.trim();
    if (!id) {
      throw pageComponentNotFoundError(req.id);
    }

    const component = await getComponentById(Number(id), workspaceId);
    if (!component) {
      throw pageComponentNotFoundError(id);
    }

    // Delete the component
    await db.delete(pageComponent).where(eq(pageComponent.id, component.id));

    return { success: true };
  },

  async updateComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const id = req.id?.trim();
    if (!id) {
      throw pageComponentNotFoundError(req.id);
    }

    const component = await getComponentById(Number(id), workspaceId);
    if (!component) {
      throw pageComponentNotFoundError(id);
    }

    // Validate group exists if provided
    if (req.groupId !== undefined && req.groupId !== "") {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.name !== undefined && req.name !== "") {
      updateValues.name = req.name;
    }
    if (req.description !== undefined) {
      updateValues.description = req.description || null;
    }
    if (req.order !== undefined) {
      updateValues.order = req.order;
    }
    if (req.groupId !== undefined) {
      // Empty string means remove from group
      updateValues.groupId = req.groupId === "" ? null : Number(req.groupId);
    }
    if (req.groupOrder !== undefined) {
      updateValues.groupOrder = req.groupOrder;
    }

    const updatedComponent = await db
      .update(pageComponent)
      .set(updateValues)
      .where(eq(pageComponent.id, component.id))
      .returning()
      .get();

    if (!updatedComponent) {
      throw pageComponentUpdateFailedError(req.id);
    }

    return {
      component: dbComponentToProto(updatedComponent),
    };
  },

  // ==========================================================================
  // Component Groups
  // ==========================================================================

  async createComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Create the group
    const newGroup = await db
      .insert(pageComponentGroup)
      .values({
        workspaceId,
        pageId: pageData.id,
        name: req.name,
        defaultOpen: req.defaultOpen ?? false,
      })
      .returning()
      .get();

    if (!newGroup) {
      throw componentGroupCreateFailedError();
    }

    return {
      group: dbGroupToProto(newGroup),
    };
  },

  async deleteComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const id = req.id?.trim();
    if (!id) {
      throw componentGroupNotFoundError(req.id);
    }

    const group = await getGroupById(Number(id), workspaceId);
    if (!group) {
      throw componentGroupNotFoundError(id);
    }

    // Delete the group (components will have groupId set to null due to FK constraint)
    await db
      .delete(pageComponentGroup)
      .where(eq(pageComponentGroup.id, group.id));

    return { success: true };
  },

  async updateComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const id = req.id?.trim();
    if (!id) {
      throw componentGroupNotFoundError(req.id);
    }

    const group = await getGroupById(Number(id), workspaceId);
    if (!group) {
      throw componentGroupNotFoundError(id);
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.name !== undefined && req.name !== "") {
      updateValues.name = req.name;
    }

    if (req.defaultOpen !== undefined) {
      updateValues.defaultOpen = req.defaultOpen;
    }

    const updatedGroup = await db
      .update(pageComponentGroup)
      .set(updateValues)
      .where(eq(pageComponentGroup.id, group.id))
      .returning()
      .get();

    if (!updatedGroup) {
      throw componentGroupUpdateFailedError(req.id);
    }

    return {
      group: dbGroupToProto(updatedGroup),
    };
  },

  // ==========================================================================
  // Subscribers
  // ==========================================================================

  async subscribeToPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;
    const limits = rpcCtx.workspace.limits;

    checkStatusSubscribersLimit(limits);

    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    const result = await upsertEmailSubscription({
      email: req.email,
      pageId: pageData.id,
    });

    const row = await db
      .select()
      .from(pageSubscriber)
      .where(eq(pageSubscriber.id, result.id))
      .get();

    if (!row) {
      throw subscriberCreateFailedError();
    }

    if (!result.acceptedAt) {
      const verifyUrl = pageData.customDomain
        ? `https://${pageData.customDomain}/verify/${result.token}`
        : `https://${pageData.slug}.openstatus.dev/verify/${result.token}`;

      const channel = getChannel("email");
      if (channel?.sendVerification) {
        try {
          await channel.sendVerification(
            {
              id: result.id,
              pageId: pageData.id,
              pageName: pageData.title,
              pageSlug: pageData.slug,
              customDomain: pageData.customDomain,
              componentIds: [],
              channelType: "email",
              email: result.email,
              token: result.token ?? undefined,
            },
            verifyUrl,
          );
        } catch (err) {
          console.error("Failed to send verification email:", err);
        }
      }
    }

    return {
      subscriber: dbSubscriberToProto(row),
    };
  },

  async createPageSubscription(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!rpcCtx.workspace.limits["status-subscribers"]) {
      throw new ConnectError(
        "Upgrade to use status subscribers",
        Code.PermissionDenied,
      );
    }

    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    const componentIds = (req.componentIds ?? []).map((id) => Number(id));
    const name = req.name ?? null;

    let subscriberRow: DBPageSubscriber | undefined;
    try {
      if (req.channel.case === "emailChannel") {
        const created = await createSubscriptionService({
          pageId: pageData.id,
          channelType: "email",
          email: req.channel.value.email,
          name,
          componentIds,
        });
        subscriberRow = await db
          .select()
          .from(pageSubscriber)
          .where(eq(pageSubscriber.id, created.id))
          .get();
      } else if (req.channel.case === "webhookChannel") {
        const webhookUrl = req.channel.value.webhookUrl;
        if (detectWebhookFlavor(webhookUrl) === "generic") {
          throw new ConnectError(
            "Only Slack and Discord webhook URLs are supported.",
            Code.InvalidArgument,
          );
        }
        const headers = protoHeadersToPlain(req.channel.value.headers);
        const created = await createSubscriptionService({
          pageId: pageData.id,
          channelType: "webhook",
          webhookUrl,
          name,
          channelConfig: headers.length > 0 ? { headers } : undefined,
          componentIds,
        });
        subscriberRow = await db
          .select()
          .from(pageSubscriber)
          .where(eq(pageSubscriber.id, created.id))
          .get();
      } else {
        throw new ConnectError(
          "channel oneof must be set to email_channel or webhook_channel",
          Code.InvalidArgument,
        );
      }
    } catch (error) {
      if (error instanceof ConnectError) throw error;
      // Don't echo raw service-layer error messages to RPC clients; they may
      // contain details that shouldn't be exposed. Log server-side for debugging.
      console.error("createPageSubscription failed:", error);
      throw subscriberCreateFailedError();
    }

    if (!subscriberRow) {
      throw subscriberCreateFailedError();
    }

    return {
      subscriber: dbSubscriberToProto({
        ...subscriberRow,
        componentIds,
      }),
    };
  },

  async unsubscribeFromPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Find subscriber based on identifier type
    if (req.identifier.case === "email") {
      const subscriber = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, pageData.id),
            sql`LOWER(${pageSubscriber.email}) = ${req.identifier.value.toLowerCase()}`,
            eq(pageSubscriber.channelType, "email"),
            isNull(pageSubscriber.unsubscribedAt),
          ),
        )
        .get();

      if (!subscriber) {
        throw subscriberNotFoundError(req.identifier.value);
      }

      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));

      return { success: true };
    }

    if (req.identifier.case === "id") {
      const subscriber = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, pageData.id),
            eq(pageSubscriber.id, Number(req.identifier.value)),
          ),
        )
        .get();

      if (!subscriber) {
        throw subscriberNotFoundError(req.identifier.value);
      }

      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));

      return { success: true };
    }

    throw identifierRequiredError();
  },

  async listSubscribers(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    // Build conditions
    const conditions = [eq(pageSubscriber.pageId, pageData.id)];
    if (!req.includeUnsubscribed) {
      conditions.push(isNull(pageSubscriber.unsubscribedAt));
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(pageSubscriber)
      .where(and(...conditions))
      .get();

    const totalCount = countResult?.count ?? 0;

    // Get subscribers
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(and(...conditions))
      .orderBy(desc(pageSubscriber.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      subscribers: subscribers.map(dbSubscriberToProto),
      totalSize: totalCount,
    };
  },

  // ==========================================================================
  // Full Content & Status
  // ==========================================================================

  async getStatusPageContent(req, ctx) {
    // Note: This endpoint may be used publicly, so we need to handle
    // the case where we look up by slug without workspace scope
    type PageData = Awaited<ReturnType<typeof getPageById>>;
    let pageData: PageData;
    let identifierValue: string;
    let isPublicAccess = false;

    if (req.identifier.case === "id") {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      identifierValue = req.identifier.value;
      pageData = await getPageById(Number(identifierValue), workspaceId);
    } else if (req.identifier.case === "slug") {
      identifierValue = req.identifier.value;
      pageData = await getPageBySlug(identifierValue);
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

    // Get components
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, pageData.id))
      .orderBy(pageComponent.order)
      .all();

    // Get groups
    const groups = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.pageId, pageData.id))
      .all();

    // Get active status reports (not resolved)
    const activeReports = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageData.id),
          inArray(statusReport.status, [
            "investigating",
            "identified",
            "monitoring",
          ]),
        ),
      )
      .orderBy(desc(statusReport.createdAt))
      .all();

    // Get status report updates for active reports
    const reportIds = activeReports.map((r) => r.id);
    const reportUpdates =
      reportIds.length > 0
        ? await db
            .select()
            .from(statusReportUpdate)
            .where(inArray(statusReportUpdate.statusReportId, reportIds))
            .orderBy(desc(statusReportUpdate.date))
            .all()
        : [];

    // Get page component IDs for each report
    const reportComponents =
      reportIds.length > 0
        ? await db
            .select()
            .from(statusReportsToPageComponents)
            .where(
              inArray(statusReportsToPageComponents.statusReportId, reportIds),
            )
            .all()
        : [];

    // Import the converter from status-report service
    const { dbStatusToProto } = await import("../status-report/converters");

    // Convert reports to proto format
    const statusReports = activeReports.map((report) => {
      const updates = reportUpdates.filter(
        (u) => u.statusReportId === report.id,
      );
      const componentIds = reportComponents
        .filter((rc) => rc.statusReportId === report.id)
        .map((rc) => String(rc.pageComponentId));

      return {
        $typeName: "openstatus.status_report.v1.StatusReport" as const,
        id: String(report.id),
        status: dbStatusToProto(report.status),
        title: report.title,
        pageComponentIds: componentIds,
        updates: updates.map((u) => ({
          $typeName: "openstatus.status_report.v1.StatusReportUpdate" as const,
          id: String(u.id),
          status: dbStatusToProto(u.status),
          date: u.date.toISOString(),
          message: u.message,
          createdAt: u.createdAt?.toISOString() ?? "",
        })),
        createdAt: report.createdAt?.toISOString() ?? "",
        updatedAt: report.updatedAt?.toISOString() ?? "",
      };
    });

    // Get maintenances for the page (upcoming and recent)
    const pageMaintenances = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.pageId, pageData.id))
      .orderBy(desc(maintenance.from))
      .all();

    // Get component associations for maintenances
    const maintenanceIds = pageMaintenances.map((m) => m.id);
    const maintenanceComponents =
      maintenanceIds.length > 0
        ? await db
            .select()
            .from(maintenancesToPageComponents)
            .where(
              inArray(
                maintenancesToPageComponents.maintenanceId,
                maintenanceIds,
              ),
            )
            .all()
        : [];

    // Convert maintenances to proto format
    const maintenancesProto = pageMaintenances.map((m) => {
      const componentIds = maintenanceComponents
        .filter((mc) => mc.maintenanceId === m.id)
        .map((mc) => String(mc.pageComponentId));

      return {
        $typeName: "openstatus.maintenance.v1.MaintenanceSummary" as const,
        id: String(m.id),
        title: m.title,
        message: m.message,
        from: m.from.toISOString(),
        to: m.to.toISOString(),
        pageId: String(pageData.id),
        pageComponentIds: componentIds,
        createdAt: m.createdAt?.toISOString() ?? "",
        updatedAt: m.updatedAt?.toISOString() ?? "",
      };
    });

    const statusPage = dbPageToProto(pageData);
    if (isPublicAccess) {
      statusPage.password = "";
      statusPage.authEmailDomains = [];
      statusPage.allowedIpRanges = "";
    }

    return {
      statusPage,
      components: components.map(dbComponentToProto),
      groups: groups.map(dbGroupToProto),
      statusReports,
      maintenances: maintenancesProto,
    };
  },

  async getOverallStatus(req, ctx) {
    type PageData = Awaited<ReturnType<typeof getPageById>>;
    let pageData: PageData;
    let identifierValue: string;
    let isPublicAccess = false;

    if (req.identifier.case === "id") {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      identifierValue = req.identifier.value;
      pageData = await getPageById(Number(identifierValue), workspaceId);
    } else if (req.identifier.case === "slug") {
      identifierValue = req.identifier.value;
      pageData = await getPageBySlug(identifierValue);
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

    // Get components
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, pageData.id))
      .all();

    const componentIds = components.map((c) => c.id);
    const now = new Date();

    // Check for active status reports (degraded state)
    let hasActiveStatusReport = false;
    const componentReportStatus = new Map<number, boolean>();

    if (componentIds.length > 0) {
      const activeReports = await db
        .select({
          componentId: statusReportsToPageComponents.pageComponentId,
        })
        .from(statusReportsToPageComponents)
        .innerJoin(
          statusReport,
          eq(statusReportsToPageComponents.statusReportId, statusReport.id),
        )
        .where(
          and(
            inArray(
              statusReportsToPageComponents.pageComponentId,
              componentIds,
            ),
            inArray(statusReport.status, [
              "investigating",
              "identified",
              "monitoring",
            ]),
          ),
        )
        .all();

      hasActiveStatusReport = activeReports.length > 0;

      // Track which components have active reports
      for (const report of activeReports) {
        componentReportStatus.set(report.componentId, true);
      }
    }

    // Check for active maintenances (info state - current time between from and to)
    let hasActiveMaintenance = false;
    const componentMaintenanceStatus = new Map<number, boolean>();

    const activeMaintenances = await db
      .select()
      .from(maintenance)
      .where(
        and(
          eq(maintenance.pageId, pageData.id),
          lte(maintenance.from, now),
          gte(maintenance.to, now),
        ),
      )
      .all();

    hasActiveMaintenance = activeMaintenances.length > 0;

    // Get component associations for active maintenances
    if (activeMaintenances.length > 0) {
      const maintenanceIds = activeMaintenances.map((m) => m.id);
      const maintenanceComponentAssocs = await db
        .select()
        .from(maintenancesToPageComponents)
        .where(
          inArray(maintenancesToPageComponents.maintenanceId, maintenanceIds),
        )
        .all();

      // Track which components are under maintenance
      for (const assoc of maintenanceComponentAssocs) {
        componentMaintenanceStatus.set(assoc.pageComponentId, true);
      }
    }

    // Determine overall status based on priority: degraded > maintenance > operational
    // Note: In the existing codebase, status reports indicate "degraded" state
    // and maintenances indicate "info/maintenance" state
    const overallStatus = hasActiveStatusReport
      ? OverallStatus.DEGRADED
      : hasActiveMaintenance
        ? OverallStatus.MAINTENANCE
        : OverallStatus.OPERATIONAL;

    // Build component statuses based on their individual state
    const componentStatuses = components.map((c) => {
      const hasReport = componentReportStatus.get(c.id) ?? false;
      const hasMaintenance = componentMaintenanceStatus.get(c.id) ?? false;

      const status = hasReport
        ? OverallStatus.DEGRADED
        : hasMaintenance
          ? OverallStatus.MAINTENANCE
          : OverallStatus.OPERATIONAL;

      return {
        $typeName: "openstatus.status_page.v1.ComponentStatus" as const,
        componentId: String(c.id),
        status,
      };
    });

    return {
      overallStatus,
      componentStatuses,
    };
  },
};
