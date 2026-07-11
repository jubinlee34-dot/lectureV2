import { useCallback, useMemo } from "react";
import { useSupabase } from "../contexts/SupabaseContext";
import type { Todo, TodoPriority } from "../types/lecture";

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(dateStr?: string) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

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

  const getTodosByLecture = useCallback(
    (lectureId: string) => todos.filter((t) => t.lectureId === lectureId),
    [todos]
  );

  const pendingTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);

  const overdueTodos = useMemo(() => {
    const todayKey = getTodayDateKey();
    return pendingTodos.filter((t) => {
      const dueDateKey = normalizeDateKey(t.dueDate);
      return Boolean(dueDateKey) && dueDateKey < todayKey;
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
