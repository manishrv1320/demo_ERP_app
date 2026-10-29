"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

/** Theme follows the system setting (light or dark); toasts sit above the phone tab bar. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={["light", "dark"]} disableTransitionOnChange>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
