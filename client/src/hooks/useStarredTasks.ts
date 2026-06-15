import { useMemo } from "react";
import { useSupabase } from "@/contexts/SupabaseContext";
import type { WorkTask, WorkTaskStage } from "@/types/lecture";

function dedupeByLectureStageText(tasks: WorkTask[], lectureId: string, stage: WorkTaskStage) {
  const seen = new Set<string>();

  return tasks.filter((task) => {
    if (task.lectureId !== lectureId || task.stage !== stage || !task.starred) return false;

    const key = `${task.lectureId}|${task.stage}|${task.text.trim()}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function useStarredTasks(lectureId: string) {
  const { workTasks } = useSupabase();

  const starredBeforeTasks = useMemo(
    () => dedupeByLectureStageText(workTasks, lectureId, "before"),
    [lectureId, workTasks]
  );

  const starredAfterTasks = useMemo(
    () => dedupeByLectureStageText(workTasks, lectureId, "after"),
    [lectureId, workTasks]
  );

  return { starredBeforeTasks, starredAfterTasks };
}
