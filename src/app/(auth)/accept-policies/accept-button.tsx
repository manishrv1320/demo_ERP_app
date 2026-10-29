"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptPoliciesAction } from "../actions";

export function AcceptPoliciesButton({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="w-full"
      loading={pending}
      onClick={() => start(async () => void (await acceptPoliciesAction({ next })))}
    >
      I agree — continue
    </Button>
  );
}
