"use client";

import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { StateOptions } from "@/components/ui/state-options";
import { checkGstin } from "@/lib/gst/gstin";
import { branchSchema } from "@/lib/validation/organization";
import { saveBranchAction } from "../../actions";

export function BranchForm({ defaults, isHeadOffice }: { defaults: z.input<typeof branchSchema>; isHeadOffice: boolean }) {
  const router = useRouter();
  const { form, submit, pending, formError } = useActionForm({
    schema: branchSchema,
    defaultValues: defaults,
    action: saveBranchAction,
    onSuccess: () => {
      if (!defaults.id) router.push("/app/settings/branches");
    },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errorOf(errors, "name")}>
          <Input id="name" {...form.register("name")} invalid={!!errors.name} />
        </Field>
        <Field label="Code" htmlFor="code" error={errorOf(errors, "code")} hint="Short, e.g. BLR. Used in this branch's document numbers.">
          <Input id="code" autoCapitalize="characters" maxLength={12} {...form.register("code")} invalid={!!errors.code} />
        </Field>
        <Field
          label="GSTIN"
          htmlFor="gstin"
          error={errorOf(errors, "gstin")}
          hint={isHeadOffice ? "Set in Settings → GST." : "Only if this branch has its own registration."}
        >
          <Input
            id="gstin"
            autoCapitalize="characters"
            maxLength={15}
            readOnly={isHeadOffice}
            {...form.register("gstin", {
              onBlur: (event) => {
                const result = checkGstin(event.target.value);
                if (result.ok) {
                  form.setValue("gstin", result.gstin);
                  form.setValue("stateCode", result.stateCode);
                }
              },
            })}
            invalid={!!errors.gstin}
          />
        </Field>
        <Field label="State" htmlFor="stateCode" error={errorOf(errors, "stateCode")}>
          <Select
            id="stateCode"
            {...form.register("stateCode")}
            aria-readonly={isHeadOffice || undefined}
            tabIndex={isHeadOffice ? -1 : undefined}
            className={isHeadOffice ? "pointer-events-none opacity-60" : undefined} invalid={!!errors.stateCode}>
            <StateOptions />
          </Select>
        </Field>
        <Field label="Address" htmlFor="addressLine1" error={errorOf(errors, "addressLine1")}>
          <Input id="addressLine1" {...form.register("addressLine1")} />
        </Field>
        <Field label="Address line 2" htmlFor="addressLine2">
          <Input id="addressLine2" {...form.register("addressLine2")} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" {...form.register("city")} />
        </Field>
        <Field label="PIN code" htmlFor="pincode" error={errorOf(errors, "pincode")}>
          <Input id="pincode" inputMode="numeric" maxLength={6} {...form.register("pincode")} invalid={!!errors.pincode} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errorOf(errors, "phone")}>
          <Input id="phone" type="tel" inputMode="tel" {...form.register("phone")} invalid={!!errors.phone} />
        </Field>
      </div>
      {isHeadOffice ? null : <Checkbox {...form.register("isActive")} label="Active" description="Inactive branches can't be chosen on new documents." />}
      <FormError message={formError} />
      <StickyActions>
        <ButtonLink href="/app/settings/branches" variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={pending}>
          {defaults.id ? "Save" : "Add branch"}
        </Button>
      </StickyActions>
    </form>
  );
}
