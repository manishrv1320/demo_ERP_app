import type { PolicyBlock } from "@/server/policies";
import { formatDate } from "@/lib/dates";

/** Renders a plain-text policy as headings, paragraphs and lists. No HTML is ever interpreted. */
export function PolicyView({ title, version, versionAt, blocks }: { title: string; version: number; versionAt: Date; blocks: PolicyBlock[] }) {
  const groups: (PolicyBlock | PolicyBlock[])[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.kind === "item") {
      if (Array.isArray(last)) last.push(block);
      else groups.push([block]);
    } else groups.push(block);
  }
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="text-[28px] font-semibold md:text-[34px]">{title}</h1>
      <p className="mt-2 text-[13px] text-[var(--a-muted)]">
        Version {version} · effective {formatDate(versionAt)}
      </p>
      <div className="mt-8 space-y-4 text-[15px] leading-relaxed">
        {groups.map((group, index) =>
          Array.isArray(group) ? (
            <ul key={index} className="list-disc space-y-1.5 pl-5">
              {group.map((item, itemIndex) => (
                <li key={itemIndex}>{item.text}</li>
              ))}
            </ul>
          ) : group.kind === "heading" ? (
            <h2 key={index} className="pt-4 text-[18px] font-semibold">
              {group.text}
            </h2>
          ) : (
            <p key={index}>{group.text}</p>
          ),
        )}
      </div>
    </article>
  );
}
