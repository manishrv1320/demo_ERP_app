import "server-only";

import { raw } from "./raw";

/**
 * The global (non-tenant) tables, for sign-in, sessions, codes and policies.
 *
 * None of these hold a company's business data, so they're exposed directly.
 * Tenant tables are deliberately missing — reach those through `forOrg()` or a
 * named cross-tenant function in ./identity.ts.
 */
export const globalDb = {
  user: raw.user,
  session: raw.session,
  verificationCode: raw.verificationCode,
  policy: raw.policy,
  policyAcceptance: raw.policyAcceptance,
  platformSettings: raw.platformSettings,
};
