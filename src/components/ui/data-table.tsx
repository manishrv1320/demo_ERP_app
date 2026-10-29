import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * One list component for every screen: a table from the md breakpoint up, and
 * cards below it (phones). Each column says how it appears on a card.
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** On phones: the card's title, its subtitle, a right-aligned value, a labelled line, or hidden. */
  mobile?: "title" | "subtitle" | "value" | "line" | "hidden";
  className?: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | null;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const title = columns.find((column) => column.mobile === "title") ?? columns[0]!;
  const subtitle = columns.filter((column) => column.mobile === "subtitle");
  const value = columns.find((column) => column.mobile === "value");
  const lines = columns.filter((column) => column.mobile === "line");

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)] md:block">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--a-border)] text-[12px] text-[var(--a-muted)]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn("px-4 py-2.5 font-medium", column.align === "right" && "text-right", column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--a-border)]">
            {rows.map((row) => {
              const href = rowHref?.(row) ?? null;
              return (
                <tr key={rowKey(row)} className={cn(href && "transition-colors hover:bg-[var(--a-hover)]")}>
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn("px-4 py-3 align-top", column.align === "right" && "text-right tabular-nums", column.className)}
                    >
                      {href && index === 0 ? (
                        <Link href={href} className="font-medium text-[var(--a-fg-strong)] hover:underline">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const href = rowHref?.(row) ?? null;
          const content = (
            <div className="flex min-h-16 flex-col gap-1.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium text-[var(--a-fg-strong)]">{title.cell(row)}</div>
                  {subtitle.map((column) => (
                    <div key={column.key} className="mt-0.5 text-[13px] text-[var(--a-muted)]">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
                {value ? <div className="shrink-0 text-right text-[15px] font-medium tabular-nums">{value.cell(row)}</div> : null}
              </div>
              {lines.map((column) => (
                <div key={column.key} className="flex justify-between gap-3 text-[13px]">
                  <span className="text-[var(--a-muted)]">{column.header}</span>
                  <span className="min-w-0 text-right">{column.cell(row)}</span>
                </div>
              ))}
            </div>
          );
          return (
            <li key={rowKey(row)} className="overflow-hidden rounded-xl border border-[var(--a-border)] bg-[var(--a-panel)]">
              {href ? (
                <Link href={href} className="block active:bg-[var(--a-active)]">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Database pagination: Previous / Next links that keep the other query parameters. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const linkClass =
    "inline-flex min-h-11 items-center rounded-lg border border-[var(--a-border)] px-4 text-[13.5px] hover:bg-[var(--a-hover)] md:min-h-9";
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pages">
      <p className="text-[12.5px] text-[var(--a-muted)]">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={href(page - 1)}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={linkClass} href={href(page + 1)}>
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Parse ?page= safely. */
export function pageFrom(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 && page < 100_000 ? page : 1;
}
