"use client";

import { History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { restoreRevisionAction } from "@/app/app/(shell)/settings/revision-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/dates";

type Revision = { id: string; label: string; authorName: string; createdAt: Date };

/** Snapshots taken before each edit, newest first, each restorable (Hyperzen's revision-history.tsx). */
export function RevisionHistory({ revisions, entityType: _entityType }: { revisions: Revision[]; entityType: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<Revision | null>(null);
  const [pending, start] = useTransition();

  if (revisions.length === 0) return null;

  return (
    <details className="mt-6 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-[13.5px] font-medium">
        <History className="size-4 text-[var(--a-muted)]" /> Revision history ({revisions.length})
      </summary>
      <ul className="divide-y divide-[var(--a-border)] border-t border-[var(--a-border)]">
        {revisions.map((revision) => (
          <li key={revision.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-[13px]">
              <p className="truncate text-[var(--a-fg)]">{revision.label}</p>
              <p className="text-[12px] text-[var(--a-muted)]">
                Saved before a change by {revision.authorName} · {formatDateTime(revision.createdAt)}
              </p>
            </div>
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-lg px-3 text-[12.5px] text-[var(--accent)] hover:bg-[var(--a-hover)]"
              onClick={() => setTarget(revision)}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title="Restore this snapshot?"
        description="The current values are saved as a new snapshot first, so you can undo this."
        confirmLabel="Restore"
        tone="primary"
        pending={pending}
        onClose={() => setTarget(null)}
        onConfirm={() =>
          start(async () => {
            if (!target) return;
            const result = await restoreRevisionAction({ revisionId: target.id });
            if (result.ok) {
              toast.success(result.message ?? "Restored.");
              setTarget(null);
              router.refresh();
            } else {
              toast.error(result.message);
            }
          })
        }
      />
    </details>
  );
}
