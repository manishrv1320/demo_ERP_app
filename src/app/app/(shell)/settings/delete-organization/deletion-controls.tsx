"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelOrganizationDeletionAction, requestOrganizationDeletionAction } from "./actions";

export function RequestDeletion({ legalName }: { legalName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete this organization
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete the organization?"
        description="Members lose access now; everything is permanently deleted after 30 days unless an Owner cancels."
        confirmLabel="Schedule deletion"
        typedConfirmation={legalName}
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const result = await requestOrganizationDeletionAction({ confirmation: legalName });
            setOpen(false);
            if (result.ok) {
              toast.success(result.message ?? "Scheduled.");
              router.refresh();
            } else toast.error(result.message);
          })
        }
      />
    </>
  );
}

export function CancelDeletion() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await cancelOrganizationDeletionAction({});
          if (result.ok) {
            toast.success(result.message ?? "Cancelled.");
            router.push("/app");
            router.refresh();
          } else toast.error(result.message);
        })
      }
    >
      Cancel the deletion
    </Button>
  );
}
