"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { errorOf, FormError, useActionForm } from "@/components/ui/form";
import { loginSchema } from "@/lib/validation/auth";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const { form, submit, pending, formError } = useActionForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    refresh: false,
    action: async (values) => {
      const result = await loginAction({ ...values, next, cancelDeletion: pendingDeletion });
      if (!result.ok && result.errors?.pendingDeletion) {
        setPendingDeletion(true);
        return { ok: false, message: result.message };
      }
      return result;
    },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={errorOf(errors, "email")}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...form.register("email")} invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={errorOf(errors, "password")}>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} invalid={!!errors.password} />
      </Field>
      <FormError message={formError} />
      <Button type="submit" className="w-full" loading={pending}>
        {pendingDeletion ? "Cancel the deletion and sign in" : "Sign in"}
      </Button>
      <div className="flex justify-between text-[13.5px]">
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-[var(--accent)] hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="inline-flex min-h-11 items-center text-[var(--a-muted)] hover:text-[var(--a-fg)]">
          Create an account
        </Link>
      </div>
    </form>
  );
}
