"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";

export function SeriesFilters({
  years,
  branches,
  yearId,
  branchId,
}: {
  years: { id: string; label: string }[];
  branches: { id: string; name: string }[];
  yearId: string;
  branchId: string;
}) {
  const router = useRouter();
  const go = (fy: string, branch: string) => router.replace(`/app/settings/number-series?fy=${fy}&branch=${branch}`);
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 md:max-w-lg">
      <Select aria-label="Financial year" value={yearId} onChange={(event) => go(event.target.value, branchId)}>
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}
          </option>
        ))}
      </Select>
      <Select aria-label="Branch" value={branchId} onChange={(event) => go(yearId, event.target.value)}>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
