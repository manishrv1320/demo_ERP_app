"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { notificationSettingsSchema } from "@/lib/validation/organization";
import { saveNotificationSettingsAction } from "../actions";

export function RetentionForm({ days }: { days: number }) {
  const { form, submit, pending, formError } = useActionForm({
    schema: notificationSettingsSchema,
    defaultValues: { notificationRetentionDays: days },
    action: saveNotificationSettingsAction,
  });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="space-y-4 md:max-w-sm">
      <Field label="Keep notifications for (days)" htmlFor="days" error={errorOf(errors, "notificationRetentionDays")}>
        <Input id="days" type="number" inputMode="numeric" min={7} max={3650} {...form.register("notificationRetentionDays")} />
      </Field>
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  );
}
