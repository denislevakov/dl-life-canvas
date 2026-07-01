import { createFileRoute } from "@tanstack/react-router";

import { LifeAreaPage } from "@/components/LifeAreaPage";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Здоровье · LIFE IS GOOD" },
      { name: "description", content: "Здоровье, действия, сроки и базовые привычки." },
    ],
  }),
  component: () => (
    <LifeAreaPage
      kind="health"
      eyebrow="Форма и здоровье"
      title="Здоровье"
      description="Блоки по здоровью без перегруза: что важно сделать, в какие сроки и какие шаги держать в работе."
      placeholder="Например: чекап, сон, спорт"
      emptyTitle="Блоков здоровья пока нет"
    />
  ),
});
