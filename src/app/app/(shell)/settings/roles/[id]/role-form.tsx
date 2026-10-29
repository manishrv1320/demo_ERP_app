"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { roleSchema } from "@/lib/validation/organization";
import { deleteRoleAction, saveRoleAction } from "../actions";

type Group = { name: string; items: { key: string; label: string; description: string; grantable: boolean }[] };

export function RoleForm({
  defaults,
  groups,
  isSystem,
  minRank,
}: {
  defaults: z.input<typeof roleSchema>;
  groups: Group[];
  isSystem: boolean;
  minRank: number;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const { form, submit, pending, formError } = useActionForm({
    schema: roleSchema,
    defaultValues: defaults,
    action: saveRoleAction,
    onSuccess: () => {
      if (!defaults.id) router.push("/app/settings/roles");
    },
  });
  const errors = form.formState.errors;
  const selected = new Set(form.watch("capabilities") ?? []);

  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    form.setValue("capabilities", [...next], { shouldDirty: true });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <Field label="Name" htmlFor="name" error={errorOf(errors, "name")}>
          <Input id="name" {...form.register("name")} invalid={!!errors.name} />
        </Field>
        <Field
          label="Rank"
          htmlFor="rank"
          error={errorOf(errors, "rank")}
          hint={isSystem ? "Built-in roles keep their rank." : `${minRank} or higher (lower is more senior).`}
        >
          <Input id="rank" type="number" inputMode="numeric" min={minRank} max={99} readOnly={isSystem} {...form.register("rank")} invalid={!!errors.rank} />
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" rows={2} {...form.register("description")} />
      </Field>

      <div className="space-y-5">
        {groups.map((group) => (
          <fieldset key={group.name}>
            <legend className="mb-1 text-[12px] font-medium uppercase tracking-wide text-[var(--a-subtle)]">{group.name}</legend>
            <div className="grid gap-x-6 md:grid-cols-2">
              {group.items.map((item) => (
                <Checkbox
                  key={item.key}
                  checked={selected.has(item.key)}
                  disabled={!item.grantable}
                  onChange={(event) => toggle(item.key, event.target.checked)}
                  label={item.label}
                  description={item.grantable ? item.description : `${item.description} (You don't hold this, so you can't change it.)`}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <FormError message={formError ?? errorOf(errors, "capabilities") ?? null} />
      <StickyActions>
        {defaults.id && !isSystem ? (
          <Button variant="ghost" className="mr-auto text-[var(--a-danger)]" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
        <ButtonLink href="/app/settings/roles" variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={pending}>
          {defaults.id ? "Save" : "Create role"}
        </Button>
      </StickyActions>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this role?"
        description="Only possible when no member has it. A snapshot is kept in revision history."
        confirmLabel="Delete role"
        pending={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          startDelete(async () => {
            const result = await deleteRoleAction({ id: defaults.id! });
            setConfirmDelete(false);
            if (result.ok) {
              toast.success(result.message ?? "Deleted.");
              router.push("/app/settings/roles");
            } else toast.error(result.message);
          })
        }
      />
    </form>
  );
}
