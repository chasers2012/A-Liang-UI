"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isDark = resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "切换为浅色"
      : "切换为深色"
    : "切换主题";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      disabled={!mounted}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4 shrink-0" aria-hidden />
        ) : (
          <Moon className="size-4 shrink-0" aria-hidden />
        )
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
    </Button>
  );
}
