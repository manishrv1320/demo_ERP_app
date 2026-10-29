"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addFinancialYearAction } from "../actions";

export function AddYearButtons({ options }: { options: { startDate: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {options.map((option, index) => (
        <Button
          key={option.startDate}
          variant={index === 0 ? "primary" : "secondary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await addFinancialYearAction({ startDate: option.startDate });
              if (result.ok) {
                toast.success(result.message ?? "Added.");
                router.refresh();
              } else {
                toast.error(result.errors?.startDate ?? result.message);
              }
            })
          }
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
