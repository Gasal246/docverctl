"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useEffect } from "react";

import { ThemeProvider, useThemeMode } from "@/components/providers/theme-provider";

function AppToaster() {
  const { resolvedTheme } = useThemeMode();

  return <Toaster richColors position="top-right" theme={resolvedTheme} />;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const preventDefaultContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener("contextmenu", preventDefaultContextMenu);
    return () => {
      document.removeEventListener("contextmenu", preventDefaultContextMenu);
    };
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <AppToaster />
      </ThemeProvider>
    </SessionProvider>
  );
}
