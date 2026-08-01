const padDatePart = (value: number) => String(value).padStart(2, "0");

export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const localMonthKey = (date = new Date()) => localDateKey(date).slice(0, 7);

export const formatMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;

  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1, 12));
};

