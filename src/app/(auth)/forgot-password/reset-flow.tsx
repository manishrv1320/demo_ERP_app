"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form";
import { completeResetAction, requestResetCodeAction, verifyResetCodeAction } from "../actions";

type Step = "ask" | "code" | "password" | "done";

/** Three steps: send a code → enter it → choose a new password. */
export function ResetFlow() {
  const [step, setStep] = useState<Step>("ask");
  const [identifier, setIdentifier] = useState("");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<void>) => {
    setError(null);
    start(work);
  };

  if (step === "done") {
    return (
      <div className="space-y-4">
        <p className="text-[14px]">Your password has been changed and every device has been signed out.</p>
        <Link href="/login" className="block">
          <Button className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  if (step === "ask") {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const result = await requestResetCodeAction({ identifier });
            if (!result.ok) return setError(result.message);
            setDestination(result.data?.destination ?? "");
            toast.success(result.message ?? "Code sent.");
            setStep("code");
          });
        }}
      >
        <Field label="Email or phone number" htmlFor="identifier">
          <Input
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" className="w-full" loading={pending}>
          Send me a code
        </Button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const result = await verifyResetCodeAction({ identifier, code });
            if (!result.ok) return setError(result.message);
            setStep("password");
          });
        }}
      >
        <p className="text-[13.5px] text-[var(--a-muted)]">
          If {destination || "that"} matches an account, a six-digit code is on its way. It expires in 10 minutes.
        </p>
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
          Continue
        </Button>
        <button type="button" className="min-h-11 text-[13.5px] text-[var(--accent)]" onClick={() => setStep("ask")}>
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(async () => {
          const result = await completeResetAction({ password, confirm });
          if (!result.ok) return setError(result.errors?.password ?? result.errors?.confirm ?? result.message);
          setStep("done");
        });
      }}
    >
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </Field>
      <Field label="Repeat the new password" htmlFor="confirm">
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
