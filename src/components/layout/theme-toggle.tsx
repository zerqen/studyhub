"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <span className="h-9 w-9" />;
  const dark = theme === "dark";
  return (
    <button
      className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label="Тема"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
