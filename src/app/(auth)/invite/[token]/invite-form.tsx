"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form";
import { acceptInviteAction } from "../../actions";

export function AcceptInviteForm({ token, needsAccount }: { token: string; needsAccount: boolean }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await acceptInviteAction({ token, name, password, acceptPolicies });
          if (!result.ok) {
            setError(result.message);
            setErrors(result.errors ?? {});
          }
        });
      }}
    >
      {needsAccount ? (
        <>
          <Field label="Your name" htmlFor="name" error={errors.name}>
            <Input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Choose a password" htmlFor="password" hint="At least 10 characters." error={errors.password}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Checkbox
            checked={acceptPolicies}
            onChange={(event) => setAcceptPolicies(event.target.checked)}
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
          {errors.acceptPolicies ? (
            <p className="text-[12.5px] text-[var(--a-danger)]">{errors.acceptPolicies}</p>
          ) : null}
        </>
      ) : null}
      <FormError message={error} />
      <Button type="submit" className="w-full" loading={pending}>
        {needsAccount ? "Create login and join" : "Accept and join"}
      </Button>
    </form>
  );
}
