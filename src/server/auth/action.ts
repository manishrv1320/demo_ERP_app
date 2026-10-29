import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { can, isOwner, type Capability } from "@/lib/rbac";
import type { ActionResult } from "@/lib/utils";
import { fieldErrors } from "@/lib/validation/common";
import { describeError } from "@/server/errors";
import { getAppContext, type AppContext } from "./context";
import { getSession, type CurrentSession } from "./session";

/**
 * Every server action in /app goes through this wrapper:
 *   1. the session and membership are resolved (re-checked on every call);
 *   2. support sessions are refused — they're read-only;
 *   3. the capability is checked on the server (rule 4: hiding a button doesn't count);
 *   4. the input is validated with the same Zod schema the form uses;
 *   5. errors become a safe ActionResult instead of leaking details.
 *
 * Usage, in a "use server" file:
 *   export const saveBranch = action({ capability: "settings.write", schema: branchSchema }, async (ctx, input) => …);
 */
type ActionOptions<S extends z.ZodTypeAny> = {
  /** Required capability (any of a list), or "owner" for the system Owner role only. */
  capability: Capability | Capability[] | "owner" | null;
  schema: S;
  /** Only the cancel-deletion action works while the organization is pending deletion. */
  allowWhenPendingDeletion?: boolean;
};

export function action<S extends z.ZodTypeAny, R = undefined>(
  options: ActionOptions<S>,
  handler: (ctx: AppContext, input: z.output<S>) => Promise<ActionResult<R>>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (input) => {
    const result = await getAppContext();
    if (result.status !== "ok") {
      return { ok: false, message: "Your session has ended or changed. Reload the page and sign in again." };
    }
    const ctx = result.ctx;
    if (ctx.readOnly) return { ok: false, message: "The support view is read-only." };
    if (ctx.org.status !== "ACTIVE" && !options.allowWhenPendingDeletion) {
      return { ok: false, message: "This organization is scheduled for deletion. Cancel the deletion to make changes." };
    }

    if (options.capability) {
      const allowed =
        options.capability === "owner"
          ? isOwner(ctx.role)
          : (Array.isArray(options.capability) ? options.capability : [options.capability]).some((item) =>
              can(ctx.role, item),
            );
      if (!allowed) return { ok: false, message: "You don't have permission to do that." };
    }

    const parsed = options.schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
    }

    try {
      return await handler(ctx, parsed.data);
    } catch (error) {
      // redirect() and notFound() work by throwing; let them through.
      unstable_rethrow(error);
      const described = describeError(error);
      return {
        ok: false,
        message: described.message,
        ...(described.field ? { errors: { [described.field]: described.message } } : {}),
      };
    }
  };
}

/**
 * The same checks as `action()` for handlers that take FormData (file
 * uploads). Returns the context, or the ActionResult to send back.
 */
export async function actionContext(
  capability: Capability | null,
): Promise<{ ok: true; ctx: AppContext } | { ok: false; result: { ok: false; message: string } }> {
  const result = await getAppContext();
  if (result.status !== "ok") return { ok: false, result: { ok: false, message: "Please reload the page and sign in again." } };
  const ctx = result.ctx;
  if (ctx.readOnly) return { ok: false, result: { ok: false, message: "The support view is read-only." } };
  if (ctx.org.status !== "ACTIVE") return { ok: false, result: { ok: false, message: "This organization is scheduled for deletion." } };
  if (capability && !can(ctx.role, capability)) {
    return { ok: false, result: { ok: false, message: "You don't have permission to do that." } };
  }
  return { ok: true, ctx };
}

/** For actions about the signed-in person rather than an organization (profile, password, account deletion). */
export function userAction<S extends z.ZodTypeAny, R = undefined>(
  schema: S,
  handler: (session: CurrentSession, input: z.output<S>) => Promise<ActionResult<R>>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (input) => {
    const session = await getSession();
    if (!session) return { ok: false, message: "Your session has ended. Please sign in again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
    }
    try {
      return await handler(session, parsed.data);
    } catch (error) {
      // redirect() and notFound() work by throwing; let them through.
      unstable_rethrow(error);
      const described = describeError(error);
      return { ok: false, message: described.message };
    }
  };
}
