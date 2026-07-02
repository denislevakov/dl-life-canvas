import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "life-is-good-theme";

export type ThemeMode = "dark" | "light";

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme };
}

export function ThemeToggle({
  compact = false,
  theme,
  onToggle,
  className = "",
}: {
  compact?: boolean;
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}) {
  const isLight = theme === "light";
  const Icon = isLight ? Moon : Sun;
  const baseClass = compact
    ? "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-foreground"
    : "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)]/60 hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${baseClass} ${className}`.trim()}
      aria-label={isLight ? "Включить ночной режим" : "Включить дневной режим"}
      title={isLight ? "Ночной режим" : "Дневной режим"}
    >
      <Icon className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {!compact ? <span>{isLight ? "Ночной режим" : "Дневной режим"}</span> : null}
    </button>
  );
}
