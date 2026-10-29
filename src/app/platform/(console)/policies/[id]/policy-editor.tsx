"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { savePolicyAction } from "../../../actions";

export function PolicyEditor({ id, title, content }: { id: string; title: string; content: string }) {
  const router = useRouter();
  const [draftTitle, setTitle] = useState(title);
  const [draft, setDraft] = useState(content);
  const [publishNewVersion, setPublish] = useState(true);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Field label="Title" htmlFor="title">
        <Input id="title" value={draftTitle} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field
        label="Text"
        htmlFor="content"
        hint='Plain text. A blank line starts a paragraph, "## " starts a heading, "- " a list item. {{SUPPORT_EMAIL}} becomes the support address.'
      >
        <Textarea id="content" rows={24} value={draft} onChange={(event) => setDraft(event.target.value)} className="font-mono text-[13px]" />
      </Field>
      <Checkbox
        checked={publishNewVersion}
        onChange={(event) => setPublish(event.target.checked)}
        label="Publish as a new version"
        description="Every user accepts it again before continuing. Untick only to fix a typo."
      />
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await savePolicyAction({ id, title: draftTitle, content: draft, publishNewVersion });
            if (result.ok) {
              toast.success(result.message ?? "Saved.");
              router.refresh();
            } else toast.error(Object.values(result.errors ?? {})[0] ?? result.message);
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
