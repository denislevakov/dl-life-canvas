import { useState } from "react";

export function EditableNumber({
  value,
  editValue,
  onChange,
  suffix = "₽",
  className = "",
}: {
  value: number;
  editValue?: number;
  onChange: (n: number) => void;
  suffix?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(editValue ?? value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (!Number.isNaN(n)) onChange(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(editValue ?? value));
            setEditing(false);
          }
        }}
        className={"bg-input border border-border rounded px-2 py-1 text-sm w-32 tabular " + className}
      />
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(String(editValue ?? value));
        setEditing(true);
      }}
      className={"tabular text-left hover:text-[color:var(--gold)] transition-colors " + className}
    >
      {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} {suffix}
    </button>
  );
}
