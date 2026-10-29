"use client";

import type { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { errorOf, FormError, StickyActions, useActionForm } from "@/components/ui/form";
import { checkSeries, formatDocumentNumber, resolvePrefix } from "@/lib/numbering";
import { numberSeriesSchema } from "@/lib/validation/organization";
import { saveNumberSeriesAction } from "../../actions";

export function SeriesForm({
  defaults,
  sampleDate,
  backHref,
}: {
  defaults: z.input<typeof numberSeriesSchema>;
  sampleDate: string;
  backHref: string;
}) {
  const { form, submit, pending, formError } = useActionForm({
    schema: numberSeriesSchema,
    defaultValues: defaults,
    action: saveNumberSeriesAction,
  });
  const errors = form.formState.errors;
  const [prefix, padding, nextNumber] = form.watch(["prefix", "padding", "nextNumber"]);
  const digits = Number(padding) || 1;
  const preview = checkSeries(String(prefix ?? ""), digits).ok
    ? formatDocumentNumber(resolvePrefix(String(prefix ?? ""), sampleDate), digits, Number(nextNumber) || 1)
    : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="rounded-lg border border-[var(--a-border)] bg-[var(--a-panel-2)] px-4 py-3">
        <p className="text-[12px] text-[var(--a-muted)]">The next document will be numbered</p>
        <p className="mt-1 font-mono text-[18px] text-[var(--a-fg-strong)]">{preview ?? "—"}</p>
        {preview ? <p className="mt-1 text-[12px] text-[var(--a-muted)]">{preview.length} of 16 characters</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Prefix" htmlFor="prefix" error={errorOf(errors, "prefix")} hint="Use {FY} for 26-27, {YYYY}, {YY} or {MM}.">
          <Input id="prefix" autoCapitalize="characters" {...form.register("prefix")} invalid={!!errors.prefix} />
        </Field>
        <Field label="Digits" htmlFor="padding" error={errorOf(errors, "padding")}>
          <Input id="padding" type="number" inputMode="numeric" min={1} max={8} {...form.register("padding")} invalid={!!errors.padding} />
        </Field>
        <Field label="Next number" htmlFor="nextNumber" error={errorOf(errors, "nextNumber")} hint="Set this to continue numbering from another system.">
          <Input id="nextNumber" type="number" inputMode="numeric" min={1} {...form.register("nextNumber")} invalid={!!errors.nextNumber} />
        </Field>
        <Field label="Numbering" htmlFor="mode">
          <Select id="mode" {...form.register("mode")}>
            <option value="AUTO">Automatic — taken when a document is issued</option>
            <option value="MANUAL">Manual — typed on each document</option>
          </Select>
        </Field>
      </div>
      <FormError message={formError} />
      <StickyActions>
        <ButtonLink href={backHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </StickyActions>
    </form>
  );
}
