import { createFileRoute } from "@tanstack/react-router";

import { PageContainer } from "@/components/MetricCard";
import { RoutineChecklist } from "@/components/RoutineChecklist";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [
      { title: "Чеклист · LIFE IS GOOD" },
      { name: "description", content: "Ежедневный и еженедельный чеклист." },
    ],
  }),
  component: ChecklistPage,
});

function ChecklistPage() {
  return (
    <PageContainer>
      <h1 className="mb-5 font-display text-3xl text-foreground md:text-4xl">Чеклист</h1>
      <RoutineChecklist />
    </PageContainer>
  );
}
