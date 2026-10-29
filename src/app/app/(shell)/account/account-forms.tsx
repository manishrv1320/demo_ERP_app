"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { Badge } from "@/components/ui/surface";
import { changePasswordSchema, profileSchema } from "@/lib/validation/auth";
import { changePasswordAction, requestAccountDeletionAction, revokeSessionAction, signOutOtherDevicesAction, updateProfileAction } from "./actions";

export function ProfileForm({ defaults }: { defaults: { name: string; phone: string } }) {
  const { form, submit, pending, formError } = useActionForm({ schema: profileSchema, defaultValues: defaults, action: updateProfileAction });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errorOf(errors, "name")}>
          <Input id="name" autoComplete="name" {...form.register("name")} invalid={!!errors.name} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errorOf(errors, "phone")} hint="Optional. Lets you get reset codes by text where SMS is set up.">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} invalid={!!errors.phone} />
        </Field>
      </div>
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const { form, submit, pending, formError } = useActionForm({
    schema: changePasswordSchema,
    defaultValues: { current: "", password: "", confirm: "" },
    action: changePasswordAction,
    onSuccess: () => form.reset(),
  });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 md:grid-cols-3">
      <Field label="Current password" htmlFor="current" error={errorOf(errors, "current")}>
        <Input id="current" type="password" autoComplete="current-password" {...form.register("current")} invalid={!!errors.current} />
      </Field>
      <Field label="New password" htmlFor="new-password" error={errorOf(errors, "password")}>
        <Input id="new-password" type="password" autoComplete="new-password" {...form.register("password")} invalid={!!errors.password} />
      </Field>
      <Field label="Repeat new password" htmlFor="confirm" error={errorOf(errors, "confirm")}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} invalid={!!errors.confirm} />
      </Field>
      <div className="md:col-span-3">
        <FormError message={formError} />
        <Button type="submit" loading={pending} className="mt-2">
          Change password
        </Button>
      </div>
    </form>
  );
}

export function DeviceList({ devices }: { devices: { id: string; label: string; detail: string; current: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (work: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const result = await work();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else toast.error(result.message);
    });
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-[var(--a-border)]">
        {devices.map((device) => (
          <li key={device.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="text-[14px] text-[var(--a-fg-strong)]">
                {device.label} {device.current ? <Badge tone="accent">This device</Badge> : null}
              </p>
              <p className="text-[12px] text-[var(--a-muted)]">{device.detail}</p>
            </div>
            {device.current ? null : (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revokeSessionAction({ id: device.id }))}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {devices.length > 1 ? (
        <Button variant="secondary" disabled={pending} onClick={() => run(() => signOutOtherDevicesAction({}))}>
          Sign out of all other devices
        </Button>
      ) : null}
    </div>
  );
}

export function DeleteAccount({ blockers, alsoDeleted }: { blockers: string[]; alsoDeleted: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (blockers.length > 0) {
    return (
      <p className="text-[13.5px] text-[var(--a-warning)]">
        You&apos;re the only Owner of {blockers.join(", ")}. Make another member an Owner (Settings → Members), or delete
        that organization, before deleting your account.
      </p>
    );
  }
  return (
    <>
      {alsoDeleted.length > 0 ? (
        <p className="mb-3 text-[13.5px] text-[var(--a-muted)]">
          You&apos;re the only member of {alsoDeleted.join(", ")}, so {alsoDeleted.length === 1 ? "it" : "they"} will be deleted too.
        </p>
      ) : null}
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete your account?"
        description="You'll be signed out of every device now. Sign in again within 30 days to cancel."
        confirmLabel="Delete my account"
        typedConfirmation="DELETE"
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const result = await requestAccountDeletionAction({ confirmation: "DELETE" });
            if (result && !result.ok) {
              setOpen(false);
              toast.error(result.message);
            }
          })
        }
      />
    </>
  );
}
