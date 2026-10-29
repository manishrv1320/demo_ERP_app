"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import type { SmtpInput } from "@/lib/validation/organization";
import { savePlatformEmailAction } from "../../actions";

type Values = SmtpInput & { supportEmail: string };

export function PlatformEmailForm({ defaults, hasPassword }: { defaults: Values; hasPassword: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const text = (key: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={key} error={errors[key]}>
      <Input id={key} value={String(values[key] ?? "")} onChange={set(key)} {...props} />
    </Field>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await savePlatformEmailAction({ ...values, smtpPort: Number(values.smtpPort) || null });
          if (result.ok) {
            toast.success(result.message ?? "Saved.");
            setErrors({});
            setValues((current) => ({ ...current, smtpPassword: "" }));
            router.refresh();
          } else {
            setErrors(result.errors ?? {});
            toast.error(result.message);
          }
        });
      }}
    >
      <Checkbox checked={Boolean(values.smtpEnabled)} onChange={set("smtpEnabled")} label="Send system email" />
      <div className="grid gap-4 md:grid-cols-2">
        {text("smtpHost", "SMTP server", { autoCapitalize: "off" })}
        {text("smtpPort", "Port", { type: "number", inputMode: "numeric" })}
        {text("smtpUser", "Username", { autoComplete: "off", autoCapitalize: "off" })}
        <Field label="Password" htmlFor="smtpPassword" hint={hasPassword ? "Saved. Leave empty to keep it." : "Stored encrypted."}>
          <Input id="smtpPassword" type="password" autoComplete="new-password" value={values.smtpPassword ?? ""} onChange={set("smtpPassword")} />
        </Field>
        {text("smtpFromName", "From name")}
        {text("smtpFromEmail", "From address", { type: "email" })}
        {text("supportEmail", "Support address shown in the policies", { type: "email" })}
      </div>
      <Checkbox checked={Boolean(values.smtpSecure)} onChange={set("smtpSecure")} label="Use SSL/TLS from the start (port 465)" />
      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  );
}
