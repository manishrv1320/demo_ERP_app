import "server-only";

import { globalDb } from "@/server/db/global";
import { supportEmail } from "@/server/email/platform";
import { DEFAULT_POLICIES } from "./policies-content";

/**
 * Terms and Privacy with version-based acceptance (Hyperzen's src/lib/policies.ts).
 * Policies are platform-wide; each user accepts each version once.
 */

export type PolicySummary = { id: string; slug: string; title: string; version: number };

/** Create the default policies the first time they're needed. */
async function ensurePolicies(): Promise<void> {
  const count = await globalDb.policy.count();
  if (count >= DEFAULT_POLICIES.length) return;
  for (const policy of DEFAULT_POLICIES) {
    await globalDb.policy.upsert({
      where: { slug: policy.slug },
      create: policy,
      update: {},
    });
  }
}

export async function activePolicies(): Promise<PolicySummary[]> {
  await ensurePolicies();
  return globalDb.policy.findMany({
    where: { isActive: true },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, version: true },
  });
}

/** Policies (at their current version) the user hasn't accepted yet. */
export async function outstandingPolicies(userId: string): Promise<PolicySummary[]> {
  const policies = await activePolicies();
  if (policies.length === 0) return [];
  const accepted = await globalDb.policyAcceptance.findMany({
    where: { userId, policyId: { in: policies.map((policy) => policy.id) } },
    select: { policyId: true, version: true },
  });
  const done = new Set(accepted.map((row) => `${row.policyId}:${row.version}`));
  return policies.filter((policy) => !done.has(`${policy.id}:${policy.version}`));
}

export async function recordAcceptances(
  userId: string,
  policies: PolicySummary[],
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  if (policies.length === 0) return;
  await globalDb.policyAcceptance.createMany({
    data: policies.map((policy) => ({
      policyId: policy.id,
      version: policy.version,
      userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })),
    skipDuplicates: true,
  });
}

export type PolicyBlock = { kind: "heading" | "paragraph" | "item"; text: string };

/** Plain-text policy → blocks for rendering. No HTML is ever interpreted. */
export function policyBlocks(content: string, contact: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  for (const chunk of content.replace(/\{\{SUPPORT_EMAIL\}\}/g, contact).split(/\n\s*\n/)) {
    for (const line of chunk.split("\n")) {
      const text = line.trim();
      if (!text) continue;
      if (text.startsWith("## ")) blocks.push({ kind: "heading", text: text.slice(3) });
      else if (text.startsWith("- ")) blocks.push({ kind: "item", text: text.slice(2) });
      else blocks.push({ kind: "paragraph", text });
    }
  }
  return blocks;
}

export async function policyPage(slug: string) {
  await ensurePolicies();
  const policy = await globalDb.policy.findUnique({ where: { slug } });
  if (!policy || !policy.isActive) return null;
  const contact = (await supportEmail()) ?? "the contact details at https://hyperzen.in";
  return { ...policy, blocks: policyBlocks(policy.content, contact) };
}
