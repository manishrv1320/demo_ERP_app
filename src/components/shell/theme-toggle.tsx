"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "Theme: follows your device", light: "Theme: light", dark: "Theme: dark" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (mounted && ORDER.includes(theme as (typeof ORDER)[number]) ? theme : "system") as (typeof ORDER)[number];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!)}
      className="flex size-11 items-center justify-center rounded-lg text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-fg)] md:size-9"
      aria-label={LABEL[current]}
      title={LABEL[current]}
    >
      <Icon className="size-5 md:size-[18px]" />
    </button>
  );
}
