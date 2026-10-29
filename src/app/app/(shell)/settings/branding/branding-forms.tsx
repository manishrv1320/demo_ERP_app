"use client";

import { ImageUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { removeLogoAction, resetBrandingAction, saveBrandingAction, uploadLogoAction } from "../actions";

export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const upload = (file: File) =>
    start(async () => {
      const data = new FormData();
      data.set("logo", file);
      const result = await uploadLogoAction(data);
      if (result.ok) {
        toast.success(result.message ?? "Logo saved.");
        router.refresh();
      } else toast.error(result.message);
    });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, authenticated image route
          <img src={`${logoUrl}?v=${encodeURIComponent(logoUrl)}`} alt="Current logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageUp className="size-7 text-[var(--a-subtle)]" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        <Button onClick={() => input.current?.click()} loading={pending}>
          {logoUrl ? "Replace logo" : "Upload logo"}
        </Button>
        {logoUrl ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await removeLogoAction({});
                if (result.ok) router.refresh();
                else toast.error(result.message);
              })
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function BrandingForm({ accentColor, accentColor2, custom }: { accentColor: string; accentColor2: string; custom: boolean }) {
  const router = useRouter();
  const [first, setFirst] = useState(accentColor);
  const [second, setSecond] = useState(accentColor2);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Accent", value: first, set: setFirst, id: "accent" },
          { label: "Second accent", value: second, set: setSecond, id: "accent2" },
        ].map((item) => (
          <Field key={item.id} label={item.label} htmlFor={item.id}>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label={`${item.label} picker`}
                value={/^#[0-9a-f]{6}$/i.test(item.value) ? item.value : "#5b8cff"}
                onChange={(event) => item.set(event.target.value)}
                className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-[var(--a-border)] bg-transparent md:h-10"
              />
              <Input id={item.id} value={item.value} onChange={(event) => item.set(event.target.value)} maxLength={7} />
            </div>
          </Field>
        ))}
      </div>
      <div className="h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${first}, ${second})` }} aria-hidden />
      {error ? <p className="text-[13px] text-[var(--a-danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await saveBrandingAction({ accentColor: first, accentColor2: second });
              if (result.ok) {
                toast.success(result.message ?? "Saved.");
                router.refresh();
              } else setError(Object.values(result.errors ?? {})[0] ?? result.message);
            })
          }
        >
          Save colours
        </Button>
        {custom ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await resetBrandingAction({});
                setFirst("#5b8cff");
                setSecond("#8b5cf6");
                router.refresh();
              })
            }
          >
            Reset to default
          </Button>
        ) : null}
      </div>
    </div>
  );
}
