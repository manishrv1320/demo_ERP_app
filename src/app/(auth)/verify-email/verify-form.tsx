"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form";
import { sendVerificationCodeAction, verifyEmailAction } from "../actions";

export function VerifyEmailForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [sending, startSending] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await verifyEmailAction({ code });
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <Field label="Code" htmlFor="code">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          className="tracking-[0.4em]"
          required
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" loading={pending}>
        Verify
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        loading={sending}
        onClick={() =>
          startSending(async () => {
            const result = await sendVerificationCodeAction();
            if (result.ok) toast.success(result.message ?? "Code sent.");
            else toast.error(result.message);
          })
        }
      >
        Send a new code
      </Button>
    </form>
  );
}
