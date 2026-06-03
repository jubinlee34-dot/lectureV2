/**
 * 강의 아카이브 V2 - 할일(Todo) 관리 커스텀 훅
 *
 * LocalStorage에 할일 목록을 저장하고 관리합니다.
 */

import { useCallback, useEffect, useState } from "react";
import { dummyTodos } from "../data/dummyData";
import type { Todo, TodoPriority } from "../types/lecture";

const STORAGE_KEY = "lecture-archive-v2-todos";

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Todo[];
  } catch {
    // ignore
  }
  // 최초 실행 시 더미 데이터 저장
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dummyTodos));
  return dummyTodos;
}

function saveTodos(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function generateId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const addTodo = useCallback(
    (data: { text: string; priority: TodoPriority; dueDate?: string; lectureId?: string }) => {
      const newTodo: Todo = {
        id: generateId(),
        text: data.text,
        done: false,
        priority: data.priority,
        dueDate: data.dueDate,
        lectureId: data.lectureId,
        createdAt: new Date().toISOString(),
      };
      setTodos((prev) => [newTodo, ...prev]);
    },
    []
  );

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTodo = useCallback((id: string, data: Partial<Todo>) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  }, []);

  /** 특정 강의에 연결된 할일 */
  const getTodosByLecture = useCallback(
    (lectureId: string) => todos.filter((t) => t.lectureId === lectureId),
    [todos]
  );

  /** 미완료 할일만 */
  const pendingTodos = todos.filter((t) => !t.done);

  /** 오늘 마감 또는 지난 할일 */
  const overdueTodos = pendingTodos.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  });

  return {
    todos,
    pendingTodos,
    overdueTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    getTodosByLecture,
  };
}
