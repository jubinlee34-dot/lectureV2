import { useCallback, useMemo } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import type { Todo, TodoPriority } from "../types/lecture";

export function useTodos() {
  const {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    bulkDeleteTodos,
    bulkUpdateTodos,
    loading,
    error,
  } = useSupabase();

  /** 특정 강의에 연결된 할일 */
  const getTodosByLecture = useCallback(
    (lectureId: string) => todos.filter((t) => t.lectureId === lectureId),
    [todos]
  );

  /** 미완료 할일만 */
  const pendingTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);

  /** 오늘 마감 또는 지난 할일 */
  const overdueTodos = useMemo(() => {
    return pendingTodos.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    });
  }, [pendingTodos]);

  return {
    todos,
    pendingTodos,
    overdueTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    bulkDeleteTodos,
    bulkUpdateTodos,
    getTodosByLecture,
    loading,
    error,
  };
}
