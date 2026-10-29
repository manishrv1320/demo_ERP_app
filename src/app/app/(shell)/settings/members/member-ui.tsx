"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { Badge } from "@/components/ui/surface";
import { inviteSchema } from "@/lib/validation/organization";
import { changeMemberRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction } from "./actions";

type RoleOption = { id: string; name: string };

export function InviteForm({ roles }: { roles: RoleOption[] }) {
  const [link, setLink] = useState<string | null>(null);
  const defaultRole = roles.find((role) => role.name === "Viewer")?.id ?? roles.at(-1)?.id ?? "";
  const { form, submit, pending, formError } = useActionForm({
    schema: inviteSchema,
    defaultValues: { email: "", roleId: defaultRole },
    action: inviteMemberAction,
    onSuccess: (result) => {
      setLink(result.data?.link ?? null);
      form.reset({ email: "", roleId: form.getValues("roleId") });
    },
  });
  const errors = form.formState.errors;

  if (roles.length === 0) {
    return <p className="text-[13.5px] text-[var(--a-muted)]">There are no roles below yours that you can give.</p>;
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} noValidate className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-start">
        <Field label="Email" htmlFor="invite-email" error={errorOf(errors, "email")}>
          <Input id="invite-email" type="email" inputMode="email" autoComplete="off" {...form.register("email")} invalid={!!errors.email} />
        </Field>
        <Field label="Role" htmlFor="invite-role" error={errorOf(errors, "roleId")}>
          <Select id="invite-role" {...form.register("roleId")}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="md:pt-6">
          <Button type="submit" loading={pending} className="w-full md:w-auto">
            Invite
          </Button>
        </div>
      </form>
      <FormError message={formError} />
      {link ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--a-border)] bg-[var(--a-panel-2)] p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate text-[12.5px]">{link}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast.success("Link copied — send it on WhatsApp or email.");
            }}
          >
            <Copy className="size-4" /> Copy link
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function InvitationList({
  invitations,
}: {
  invitations: { id: string; email: string; roleName: string; detail: string; canRevoke: boolean }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-[var(--a-border)]">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-[14px] text-[var(--a-fg-strong)]">
              {invitation.email} <Badge>{invitation.roleName}</Badge>
            </p>
            <p className="text-[12px] text-[var(--a-muted)]">{invitation.detail}</p>
          </div>
          {invitation.canRevoke ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await revokeInvitationAction({ id: invitation.id });
                  if (result.ok) router.refresh();
                  else toast.error(result.message);
                })
              }
            >
              Cancel
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type Member = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  joined: string;
  isYou: boolean;
  editable: boolean;
};

export function MemberList({ members, roles }: { members: Member[]; roles: RoleOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<Member | null>(null);

  const changeRole = (member: Member, roleId: string) =>
    start(async () => {
      const result = await changeMemberRoleAction({ membershipId: member.id, roleId });
      if (result.ok) {
        toast.success(result.message ?? "Role changed.");
        router.refresh();
      } else toast.error(result.message);
    });

  return (
    <>
      <ul className="divide-y divide-[var(--a-border)] overflow-hidden rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]">
        {members.map((member) => (
          <li key={member.id} className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-[var(--a-fg-strong)]">
                {member.name} {member.isYou ? <Badge tone="accent">You</Badge> : null}
              </p>
              <p className="truncate text-[12.5px] text-[var(--a-muted)]">
                {member.email} · joined {member.joined}
              </p>
            </div>
            {member.editable ? (
              <div className="flex gap-2">
                <Select
                  aria-label={`Role for ${member.name}`}
                  value={member.roleId}
                  disabled={pending}
                  onChange={(event) => changeRole(member, event.target.value)}
                  className="md:w-48"
                >
                  {roles.some((role) => role.id === member.roleId) ? null : <option value={member.roleId}>{member.roleName}</option>}
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" onClick={() => setRemoving(member)} disabled={pending} className="text-[var(--a-danger)]">
                  Remove
                </Button>
              </div>
            ) : (
              <Badge>{member.roleName}</Badge>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        description="They lose access to this organization straight away. Documents they created stay in the books."
        confirmLabel="Remove"
        pending={pending}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          start(async () => {
            if (!removing) return;
            const result = await removeMemberAction({ membershipId: removing.id });
            setRemoving(null);
            if (result.ok) {
              toast.success(result.message ?? "Removed.");
              router.refresh();
            } else toast.error(result.message);
          })
        }
      />
    </>
  );
}
