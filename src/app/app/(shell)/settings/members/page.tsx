import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Pagination, pageFrom } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { Card, CardTitle, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/dates";
import { can, outranks } from "@/lib/rbac";
import { requirePage } from "@/server/auth/context";
import { memberWhere } from "@/server/lists";
import { assignableRolesFor } from "@/server/members";
import { InviteForm, InvitationList, MemberList } from "./member-ui";

export const metadata: Metadata = { title: "Members" };

const PAGE_SIZE = 50;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requirePage("users.manage");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) || undefined;
  const page = pageFrom(params.page);
  const where = memberWhere(q);

  const [members, total, invitations, roles] = await Promise.all([
    ctx.db.membership.findMany({
      where,
      orderBy: { joinedAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        joinedAt: true,
        userId: true,
        user: { select: { name: true, email: true } },
        role: { select: { id: true, name: true, rank: true } },
      },
    }),
    ctx.db.membership.count({ where }),
    ctx.db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true, invitedByName: true, role: { select: { name: true, rank: true } } },
    }),
    assignableRolesFor(ctx),
  ]);

  return (
    <>
      <PageHeader title="Members" description="People who can sign in to this organization, and what their role lets them do." back={{ href: "/app/settings", label: "Settings" }}>
        <SearchBox placeholder="Search members" />
        {can(ctx.role, "data.export") ? (
          <ButtonLink href={`/api/export/members${q ? `?q=${encodeURIComponent(q)}` : ""}`} variant="secondary" prefetch={false}>
            <Download className="size-4" /> CSV
          </ButtonLink>
        ) : null}
      </PageHeader>

      <div className="space-y-4">
        <Card>
          <CardTitle title="Invite someone" description="They get an email with a link (or you can share the link). It works for 7 days." />
          <InviteForm roles={roles.map((role) => ({ id: role.id, name: role.name }))} />
        </Card>

        {invitations.length > 0 ? (
          <Card>
            <CardTitle title="Waiting to accept" />
            <InvitationList
              invitations={invitations.map((invitation) => ({
                id: invitation.id,
                email: invitation.email,
                roleName: invitation.role.name,
                detail: `Invited by ${invitation.invitedByName} · expires ${formatDate(invitation.expiresAt)}`,
                canRevoke: outranks(ctx.role, invitation.role.rank),
              }))}
            />
          </Card>
        ) : null}

        <MemberList
          roles={roles.map((role) => ({ id: role.id, name: role.name }))}
          members={members.map((member) => ({
            id: member.id,
            name: member.user.name,
            email: member.user.email,
            roleId: member.role.id,
            roleName: member.role.name,
            joined: formatDate(member.joinedAt),
            isYou: member.userId === ctx.user.id,
            editable: member.userId !== ctx.user.id && outranks(ctx.role, member.role.rank),
          }))}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/app/settings/members" params={{ q }} />
      </div>
    </>
  );
}
