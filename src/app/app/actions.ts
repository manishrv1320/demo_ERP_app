"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/utils";
import { createOrganizationSchema } from "@/lib/validation/organization";
import { fieldErrors } from "@/lib/validation/common";
import { getAppContext } from "@/server/auth/context";
import { getSession, setActiveOrganization } from "@/server/auth/session";
import { findMembership } from "@/server/db/identity";
import { createAdditionalOrganization } from "@/server/db/provision";
import { endSupportSession } from "@/server/platform/support";
import { HOUR, rateLimit } from "@/server/security/rate-limit";

/** Switch the active organization. The membership is checked before the session changes. */
export async function switchOrganizationAction(organizationId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  const id = z.string().min(1).max(40).safeParse(organizationId);
  if (!id.success) return { ok: false, message: "Unknown organization." };
  const membership = await findMembership(session.user.id, id.data);
  if (!membership || membership.status !== "ACTIVE") return { ok: false, message: "You're not a member of that organization." };
  await setActiveOrganization(session.id, id.data);
  redirect("/app");
}

/** Start another organization; the creator becomes its Owner. */
export async function createOrganizationAction(input: z.input<typeof createOrganizationSchema>): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  if (!rateLimit(`create-org:${session.user.id}`, 5, 24 * HOUR).success) {
    return { ok: false, message: "You've created several organizations today. Please try again tomorrow." };
  }
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const { organizationId } = await createAdditionalOrganization({
    userId: session.user.id,
    legalName: parsed.data.organizationName,
    stateCode: parsed.data.stateCode,
  });
  await setActiveOrganization(session.id, organizationId);
  redirect("/app");
}

/** Hyperzen staff leave the read-only support view. */
export async function endSupportViewAction(): Promise<void> {
  const result = await getAppContext();
  await endSupportSession();
  redirect(result.status === "ok" && result.ctx.kind === "support" ? `/platform/orgs/${result.ctx.org.id}` : "/platform");
}
