import { useMemo } from "react";
import { useSupabase } from "../contexts/SupabaseContext";

export function useStarredTasks(lectureId: string) {
  const { workTasks } = useSupabase();

  const starredBeforeTasks = useMemo(() => {
    return workTasks.filter((t) => t.lectureId === lectureId && t.starred && t.stage === "before");
  }, [workTasks, lectureId]);

  const starredAfterTasks = useMemo(() => {
    return workTasks.filter((t) => t.lectureId === lectureId && t.starred && t.stage === "after");
  }, [workTasks, lectureId]);

  return { starredBeforeTasks, starredAfterTasks };
}
