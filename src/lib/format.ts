export function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

export function formatMillions(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v.toFixed(v >= 10 ? 1 : 2).replace(/\.?0+$/, "")} млн ₽`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс ₽`;
  return `${n} ₽`;
}

export function formatRange(min: number, max: number): string {
  if (min === max) return formatMillions(min);
  const a = (min / 1_000_000).toFixed(1).replace(/\.0$/, "");
  const b = (max / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${a}–${b} млн ₽`;
}

export function formatShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}