"use client";

import type { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { StateOptions } from "@/components/ui/state-options";
import { checkGstin } from "@/lib/gst/gstin";
import { gstSettingsSchema } from "@/lib/validation/organization";
import { saveGstSettingsAction } from "../actions";

export function GstForm({ defaults }: { defaults: z.input<typeof gstSettingsSchema> }) {
  const { form, submit, pending, formError } = useActionForm({
    schema: gstSettingsSchema,
    defaultValues: defaults,
    action: saveGstSettingsAction,
  });
  const errors = form.formState.errors;
  const registration = form.watch("gstRegistration");

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Registration" htmlFor="gstRegistration" error={errorOf(errors, "gstRegistration")}>
        <Select id="gstRegistration" {...form.register("gstRegistration")}>
          <option value="REGULAR">Regular — charges GST on tax invoices</option>
          <option value="COMPOSITION">Composition scheme — issues bills of supply</option>
          <option value="UNREGISTERED">Not registered for GST</option>
        </Select>
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="GSTIN"
          htmlFor="gstin"
          error={errorOf(errors, "gstin")}
          hint={registration === "UNREGISTERED" ? "Leave empty if you're not registered." : "Filling it in sets the state and PAN for you."}
        >
          <Input
            id="gstin"
            autoCapitalize="characters"
            maxLength={15}
            {...form.register("gstin", {
              onBlur: (event) => {
                const result = checkGstin(event.target.value);
                if (result.ok) {
                  form.setValue("gstin", result.gstin);
                  form.setValue("stateCode", result.stateCode);
                  form.setValue("pan", result.pan);
                }
              },
            })}
            invalid={!!errors.gstin}
          />
        </Field>
        <Field label="PAN" htmlFor="pan" error={errorOf(errors, "pan")}>
          <Input id="pan" autoCapitalize="characters" maxLength={10} {...form.register("pan")} invalid={!!errors.pan} />
        </Field>
        <Field label="State" htmlFor="stateCode" error={errorOf(errors, "stateCode")} hint="Decides CGST + SGST or IGST on each invoice.">
          <Select id="stateCode" {...form.register("stateCode")} invalid={!!errors.stateCode}>
            <StateOptions />
          </Select>
        </Field>
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
