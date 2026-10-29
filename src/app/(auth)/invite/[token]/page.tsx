import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { getSession } from "@/server/auth/session";
import { globalDb } from "@/server/db/global";
import { findInvitation } from "@/server/db/identity";
import { hashToken } from "@/server/security/tokens";
import { LogoutButton } from "../../logout-button";
import { AcceptInviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Join an organization" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = token.length <= 200 ? await findInvitation(hashToken(token)) : null;
  const usable =
    invitation &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt > new Date() &&
    invitation.organization.status === "ACTIVE";

  if (!invitation || !usable) {
    return (
      <Card>
        <h1 className="text-[20px] font-semibold">This invitation can&apos;t be used</h1>
        <p className="mt-2 text-[14px] text-[var(--a-muted)]">
          It may have expired, been cancelled or already been accepted. Ask the person who invited you to send a new
          one.
        </p>
        <div className="mt-5">
          <ButtonLink href="/login" variant="secondary">
            Go to sign in
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const organizationName = invitation.organization.tradeName || invitation.organization.legalName;
  const session = await getSession();
  const hasAccount = Boolean(
    await globalDb.user.findUnique({ where: { email: invitation.email }, select: { id: true } }),
  );

  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-semibold">Join {organizationName}</h1>
      <p className="mb-6 text-[14px] text-[var(--a-muted)]">
        {invitation.invitedByName} invited {invitation.email} to join as {invitation.role.name}.
      </p>
      <Card>
        {session && session.user.email !== invitation.email ? (
          <div className="space-y-3 text-[14px]">
            <p>
              You&apos;re signed in as {session.user.email}. This invitation is for {invitation.email}.
            </p>
            <LogoutButton label="Sign out and switch account" className="min-h-11 text-[var(--accent)]" />
          </div>
        ) : !session && hasAccount ? (
          <div className="space-y-3 text-[14px]">
            <p>You already have a Hyperzen ERP login for {invitation.email}. Sign in to accept.</p>
            <ButtonLink href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="w-full">
              Sign in to accept
            </ButtonLink>
          </div>
        ) : (
          <AcceptInviteForm token={token} needsAccount={!session} />
        )}
      </Card>
      <p className="mt-4 text-center text-[12.5px] text-[var(--a-muted)]">
        Not expecting this? You can ignore it — nothing happens unless you accept.
      </p>
    </>
  );
}
