"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useEffect } from "react";

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
      {children}
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
