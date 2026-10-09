export { createPage, newPage } from "./create";
export { deletePage } from "./delete";
export {
  attachDomain,
  detachDomain,
  detachDomainIfUnused,
  getProjectDomain,
  listProjectDomains,
  reconcileProjectDomains,
  type ProjectDomain,
  resolveVercelConfig,
  type VercelDomainConfig,
  vercelConfigFromEnv,
  vercelFetch,
} from "./domain-sync";
export {
  type MaintenanceContent,
  type StatusPageContent,
  type StatusReportContent,
  getStatusPageContent,
} from "./get-content";
export {
  assertCustomDomainInWorkspace,
  getPage,
  getPageBySlug,
  getPageCustomDomain,
  getSlugAvailable,
  listPages,
  type PageListItem,
  type PageWithRelations,
} from "./list";
export { setPageCustomDomain } from "./set-custom-domain";
export {
  updatePageAppearance,
  updatePageConfiguration,
  updatePageCustomTheme,
  updatePageCustomDomain,
  updatePageGeneral,
  updatePageLinks,
  updatePageLocales,
  updatePagePasswordProtection,
} from "./update";

export {
  CreatePageInput,
  DeletePageInput,
  GetPageInput,
  GetSlugAvailableInput,
  ListPagesInput,
  NewPageInput,
  pageAccessTypes,
  UpdatePageAppearanceInput,
  UpdatePageConfigurationInput,
  UpdatePageCustomThemeInput,
  UpdatePageCustomDomainInput,
  UpdatePageGeneralInput,
  UpdatePageLinksInput,
  UpdatePageLocalesInput,
  UpdatePagePasswordProtectionInput,
} from "./schemas";
