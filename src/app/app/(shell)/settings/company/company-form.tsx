"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { companyProfileSchema } from "@/lib/validation/organization";
import type { z } from "zod";
import { saveCompanyProfileAction } from "../actions";

export function CompanyForm({ defaults }: { defaults: z.input<typeof companyProfileSchema> }) {
  const { form, submit, pending, formError } = useActionForm({
    schema: companyProfileSchema,
    defaultValues: defaults,
    action: saveCompanyProfileAction,
  });
  const errors = form.formState.errors;
  const text = (name: keyof typeof defaults, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <Field label={label} htmlFor={name} error={errorOf(errors, name)} hint={hint}>
      <Input id={name} {...form.register(name)} invalid={!!errorOf(errors, name)} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {text("legalName", "Legal name", { autoComplete: "organization" }, "Exactly as registered.")}
        {text("tradeName", "Trade name", {}, "Optional — the name customers know you by.")}
        {text("addressLine1", "Address", { autoComplete: "address-line1" })}
        {text("addressLine2", "Address line 2", { autoComplete: "address-line2" })}
        {text("city", "City", { autoComplete: "address-level2" })}
        {text("pincode", "PIN code", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
        {text("phone", "Phone", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
        {text("email", "Email", { type: "email", inputMode: "email" })}
        {text("website", "Website", { type: "url", inputMode: "url", placeholder: "https://" })}
      </div>
      <FormError message={formError} />
      <StickyActions>
        <ButtonLink href="/app/settings" variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </StickyActions>
    </form>
  );
}
