"use client";

import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { warehouseSchema } from "@/lib/validation/organization";
import { saveWarehouseAction } from "../../actions";

export function WarehouseForm({
  defaults,
  branches,
}: {
  defaults: z.input<typeof warehouseSchema>;
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { form, submit, pending, formError } = useActionForm({
    schema: warehouseSchema,
    defaultValues: defaults,
    action: saveWarehouseAction,
    onSuccess: () => {
      if (!defaults.id) router.push("/app/settings/warehouses");
    },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errorOf(errors, "name")}>
          <Input id="name" {...form.register("name")} invalid={!!errors.name} />
        </Field>
        <Field label="Code" htmlFor="code" error={errorOf(errors, "code")}>
          <Input id="code" autoCapitalize="characters" maxLength={12} {...form.register("code")} invalid={!!errors.code} />
        </Field>
        <Field label="Branch" htmlFor="branchId" error={errorOf(errors, "branchId")}>
          <Select id="branchId" {...form.register("branchId")} invalid={!!errors.branchId}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={errorOf(errors, "address")}>
        <Textarea id="address" rows={2} {...form.register("address")} />
      </Field>
      <Checkbox {...form.register("isActive")} label="Active" description="Inactive warehouses can't receive or issue stock." />
      <FormError message={formError} />
      <StickyActions>
        <ButtonLink href="/app/settings/warehouses" variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={pending}>
          {defaults.id ? "Save" : "Add warehouse"}
        </Button>
      </StickyActions>
    </form>
  );
}
