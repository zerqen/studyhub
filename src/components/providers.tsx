"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "./ui/toast";
import { PwaRegister } from "./pwa";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={["light", "dark"]} disableTransitionOnChange>
        <ToastProvider>
          {children}
          <PwaRegister />
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
