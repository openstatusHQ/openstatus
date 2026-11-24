/**
 * Custom oxlint rules for openstatus, one file per rule in `rules/`.
 *
 * Every rule has a bad/good fixture pair in `fixtures/`, checked by
 * `pnpm check:lint-rules`. A new rule adds its pair there.
 */

import noDbBarrelInClient from "./rules/no-db-barrel-in-client.js";
import noTextLinkAsChild from "./rules/no-text-link-as-child.js";
import servicesAuditOnTx from "./rules/services-audit-on-tx.js";
import servicesMutationGuards from "./rules/services-mutation-guards.js";
import servicesNoLegacyScope from "./rules/services-no-legacy-scope.js";
import servicesReadVerbsRequireScope from "./rules/services-read-verbs-require-scope.js";
import servicesScopeMatchesFolder from "./rules/services-scope-matches-folder.js";

export default {
  meta: { name: "openstatus" },
  rules: {
    "services-mutation-guards": servicesMutationGuards,
    "no-db-barrel-in-client": noDbBarrelInClient,
    "services-no-legacy-scope": servicesNoLegacyScope,
    "services-read-verbs-require-scope": servicesReadVerbsRequireScope,
    "services-scope-matches-folder": servicesScopeMatchesFolder,
    "services-audit-on-tx": servicesAuditOnTx,
    "no-text-link-as-child": noTextLinkAsChild,
  },
};
