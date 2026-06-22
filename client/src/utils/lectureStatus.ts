import type { Lecture, WorkflowStage } from "@/types/lecture";

export type LectureStatusFilter = "all" | WorkflowStage;

export const workflowStages = ["before", "after", "promoted"] as const satisfies readonly WorkflowStage[];

export const statusLabels: Record<WorkflowStage, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

export const statusBadgeClass: Record<WorkflowStage, string> = {
  before: "border-blue-200 bg-blue-100 text-blue-700",
  after: "border-amber-200 bg-amber-100 text-amber-700",
  promoted: "border-green-200 bg-green-100 text-green-700",
};

export const statusDotClass: Record<WorkflowStage, string> = {
  before: "bg-blue-500",
  after: "bg-amber-500",
  promoted: "bg-green-500",
};

const statusAliases: Record<string, WorkflowStage> = {
  before: "before",
  pending: "before",
  scheduled: "before",
  lecture_before: "before",
  after: "after",
  completed: "after",
  lecture_after: "after",
  promoted: "promoted",
  blog_done: "promoted",
  published: "promoted",
};

export function normalizeWorkflowStage(value: unknown): WorkflowStage {
  if (typeof value !== "string") return "before";
  return statusAliases[value.trim().toLowerCase()] ?? "before";
}

export function getStatusCounts(lectures: Lecture[]) {
  const counts: Record<LectureStatusFilter, number> = {
    all: lectures.length,
    before: 0,
    after: 0,
    promoted: 0,
  };

  lectures.forEach((lecture) => {
    counts[normalizeWorkflowStage(lecture.workflowStage)] += 1;
  });

  return counts;
}

export function getPreviousWorkflowStage(stage: WorkflowStage): WorkflowStage | null {
  if (stage === "promoted") return "after";
  if (stage === "after") return "before";
  return null;
}
