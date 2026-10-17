/**
 * "Unlimited" members resolves to this effective cap — matches the legacy
 * behavior in `invitationRouter.create`. Large enough that enterprise plans
 * never brush against it in practice.
 */
export const UNLIMITED_MEMBERS_EFFECTIVE_CAP = 420;
