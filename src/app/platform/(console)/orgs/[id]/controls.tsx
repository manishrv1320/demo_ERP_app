"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { openSupportViewAction, reactivateOrganizationAction, suspendOrganizationAction } from "../../../actions";

export function OrganizationControls({ organizationId, status }: { organizationId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const run = (work: (input: { organizationId: string; reason: string }) => Promise<{ ok: boolean; message?: string; errors?: Record<string, string> } | void>) =>
    start(async () => {
      const result = await work({ organizationId, reason });
      if (!result) return;
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        setReason("");
        router.refresh();
      } else toast.error(result.errors?.reason ?? result.message);
    });

  return (
    <div className="space-y-3">
      <Field label="Reason" htmlFor="reason" hint="Required for every action below.">
        <Input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending || status === "PENDING_DELETION"} onClick={() => run(openSupportViewAction)}>
          Open read-only support view (60 min)
        </Button>
        {status === "ACTIVE" ? (
          <Button variant="danger" disabled={pending} onClick={() => run(suspendOrganizationAction)}>
            Suspend
          </Button>
        ) : status === "SUSPENDED" ? (
          <Button disabled={pending} onClick={() => run(reactivateOrganizationAction)}>
            Reactivate
          </Button>
        ) : null}
      </div>
    </div>
  );
}
