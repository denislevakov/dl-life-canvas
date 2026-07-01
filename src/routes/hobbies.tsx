import { createFileRoute } from "@tanstack/react-router";

import { LifeAreaPage } from "@/components/LifeAreaPage";

export const Route = createFileRoute("/hobbies")({
  head: () => ({
    meta: [
      { title: "Хобби · LIFE IS GOOD" },
      { name: "description", content: "Хобби, коллекции, планы и действия." },
    ],
  }),
  component: () => (
    <LifeAreaPage
      kind="hobby"
      eyebrow="Личное пространство"
      title="Хобби"
      description="Хобби и коллекции: что хочется развивать, пополнять, планировать и доводить до результата."
      placeholder="Например: LEGO, ретрогейминг, кино"
      emptyTitle="Хобби пока нет"
    />
  ),
});
