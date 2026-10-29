"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { StateOptions } from "@/components/ui/state-options";
import { signUpSchema } from "@/lib/validation/auth";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const { form, submit, pending, formError } = useActionForm({
    schema: signUpSchema,
    defaultValues: { name: "", email: "", password: "", organizationName: "", stateCode: "", acceptPolicies: false as unknown as true },
    refresh: false,
    action: signUpAction,
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Your name" htmlFor="name" error={errorOf(errors, "name")}>
        <Input id="name" autoComplete="name" {...form.register("name")} invalid={!!errors.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={errorOf(errors, "email")}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...form.register("email")} invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters." error={errorOf(errors, "password")}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} invalid={!!errors.password} />
      </Field>
      <Field label="Business name" htmlFor="organizationName" hint="The legal name. You can add a trade name later." error={errorOf(errors, "organizationName")}>
        <Input id="organizationName" autoComplete="organization" {...form.register("organizationName")} invalid={!!errors.organizationName} />
      </Field>
      <Field label="State" htmlFor="stateCode" hint="Where the business is registered for GST." error={errorOf(errors, "stateCode")}>
        <Select id="stateCode" {...form.register("stateCode")} invalid={!!errors.stateCode}>
          <StateOptions />
        </Select>
      </Field>
      <div>
        <Checkbox
          {...form.register("acceptPolicies")}
          label={
            <>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-[var(--accent)] underline">
                Terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="text-[var(--accent)] underline">
                Privacy Policy
              </Link>
              .
            </>
          }
        />
        {errorOf(errors, "acceptPolicies") ? (
          <p className="text-[12.5px] text-[var(--a-danger)]">{errorOf(errors, "acceptPolicies")}</p>
        ) : null}
      </div>
      <FormError message={formError} />
      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-[13.5px] text-[var(--a-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
