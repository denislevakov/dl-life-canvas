import { createFileRoute } from "@tanstack/react-router";

import { LifeAreaPage } from "@/components/LifeAreaPage";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Проекты · LIFE IS GOOD" },
      { name: "description", content: "Проекты, действия, сроки и следующие шаги." },
    ],
  }),
  component: () => (
    <LifeAreaPage
      kind="project"
      eyebrow="Проекты в развитии"
      title="Проекты"
      description="Здесь собраны рабочие и личные проекты: что развивается, какие действия нужны и к каким срокам."
      placeholder="Например: новый сайт, продукт, система"
      emptyTitle="Проектов пока нет"
    />
  ),
});
