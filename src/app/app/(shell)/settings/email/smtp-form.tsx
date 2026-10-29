"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { smtpSchema, type SmtpInput } from "@/lib/validation/organization";
import { saveSmtpAction, sendTestEmailAction } from "../actions";

/**
 * The SMTP password is typed here by the person who owns it, sent once over
 * HTTPS and stored encrypted. It's never shown again — leave the field empty to
 * keep the saved one.
 */
export function SmtpForm({ defaults, hasPassword }: { defaults: SmtpInput; hasPassword: boolean }) {
  const { form, submit, pending, formError } = useActionForm({
    schema: smtpSchema,
    defaultValues: defaults,
    action: saveSmtpAction,
  });
  const [testing, startTest] = useTransition();
  const errors = form.formState.errors;
  const enabled = form.watch("smtpEnabled");

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Checkbox {...form.register("smtpEnabled")} label="Send email through my own mail server" />
      <fieldset disabled={!enabled} className="grid gap-4 disabled:opacity-60 md:grid-cols-2">
        <Field label="SMTP server" htmlFor="smtpHost" error={errorOf(errors, "smtpHost")}>
          <Input id="smtpHost" placeholder="smtp.example.com" autoCapitalize="off" {...form.register("smtpHost")} invalid={!!errors.smtpHost} />
        </Field>
        <Field label="Port" htmlFor="smtpPort" error={errorOf(errors, "smtpPort")}>
          <Input id="smtpPort" type="number" inputMode="numeric" {...form.register("smtpPort")} invalid={!!errors.smtpPort} />
        </Field>
        <Field label="Username" htmlFor="smtpUser">
          <Input id="smtpUser" autoComplete="off" autoCapitalize="off" {...form.register("smtpUser")} />
        </Field>
        <Field label="Password" htmlFor="smtpPassword" hint={hasPassword ? "Saved. Leave empty to keep it." : "Stored encrypted."}>
          <Input id="smtpPassword" type="password" autoComplete="new-password" {...form.register("smtpPassword")} />
        </Field>
        <Field label="From name" htmlFor="smtpFromName">
          <Input id="smtpFromName" {...form.register("smtpFromName")} />
        </Field>
        <Field label="From address" htmlFor="smtpFromEmail" error={errorOf(errors, "smtpFromEmail")}>
          <Input id="smtpFromEmail" type="email" inputMode="email" {...form.register("smtpFromEmail")} invalid={!!errors.smtpFromEmail} />
        </Field>
        <Checkbox {...form.register("smtpSecure")} label="Use SSL/TLS from the start (port 465)" className="md:col-span-2" />
      </fieldset>
      <FormError message={formError} />
      <StickyActions>
        <ButtonLink href="/app/settings" variant="secondary">
          Cancel
        </ButtonLink>
        <Button
          variant="secondary"
          loading={testing}
          disabled={!enabled}
          onClick={() =>
            startTest(async () => {
              const result = await sendTestEmailAction({});
              if (result.ok) toast.success(result.message ?? "Sent.");
              else toast.error(result.message);
            })
          }
        >
          Send test
        </Button>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </StickyActions>
    </form>
  );
}
