import { createFileRoute } from "@tanstack/react-router";

import { LifeAreaPage } from "@/components/LifeAreaPage";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Скилы · LIFE IS GOOD" },
      { name: "description", content: "Hard и soft skills, развитие и действия." },
    ],
  }),
  component: () => (
    <LifeAreaPage
      kind="skill"
      eyebrow="Soft и hard"
      title="Скилы"
      description="Навыки, которые нужно развивать: описание, горизонт и конкретные действия."
      placeholder="Например: AI, переговоры, английский"
      emptyTitle="Скилов пока нет"
    />
  ),
});
