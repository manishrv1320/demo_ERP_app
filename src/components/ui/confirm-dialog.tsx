"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";

/**
 * A confirmation dialog on the native <dialog> element. With `typedConfirmation`
 * the person must type the exact text (e.g. the organization's name) before
 * the destructive button unlocks.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  typedConfirmation,
  pending,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  typedConfirmation?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTyped("");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const locked = typedConfirmation !== undefined && typed.trim() !== typedConfirmation;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-[var(--a-border-strong)] bg-[var(--a-elevated)] p-0 text-[var(--a-fg)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {description ? <div className="mt-2 text-[13.5px] leading-relaxed text-[var(--a-muted)]">{description}</div> : null}
        {children}
        {typedConfirmation !== undefined ? (
          <div className="mt-4">
            <label className="a-label" htmlFor="typed-confirmation">
              Type <span className="font-semibold text-[var(--a-fg-strong)]">{typedConfirmation}</span> to confirm
            </label>
            <input
              id="typed-confirmation"
              className="a-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={locked} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
