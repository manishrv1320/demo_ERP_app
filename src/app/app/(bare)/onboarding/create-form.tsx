"use client";

import { createOrganizationAction } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { StateOptions } from "@/components/ui/state-options";
import { createOrganizationSchema } from "@/lib/validation/organization";

export function CreateOrganizationForm() {
  const { form, submit, pending, formError } = useActionForm({
    schema: createOrganizationSchema,
    defaultValues: { organizationName: "", stateCode: "" },
    refresh: false,
    action: createOrganizationAction,
  });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Business name" htmlFor="organizationName" error={errorOf(errors, "organizationName")}>
        <Input id="organizationName" autoComplete="organization" {...form.register("organizationName")} invalid={!!errors.organizationName} />
      </Field>
      <Field label="State" htmlFor="stateCode" error={errorOf(errors, "stateCode")}>
        <Select id="stateCode" {...form.register("stateCode")} invalid={!!errors.stateCode}>
          <StateOptions />
        </Select>
      </Field>
      <FormError message={formError} />
      <Button type="submit" className="w-full" loading={pending}>
        Create organization
      </Button>
    </form>
  );
}
