import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLectures } from "@/hooks/useLectures";
import { useTodos } from "@/hooks/useTodos";
import type { Todo, TodoPriority } from "@/types/lecture";
import {
  AlertCircle,
  Calendar,
  Check,
  ClipboardList,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function TodoPage() {
  const { lectures } = useLectures();
  const {
    todos,
    pendingTodos,
    overdueTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
  } = useTodos();

  const [showAddForm, setShowAddForm] = useState(false);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [lectureId, setLectureId] = useState<string>("none");
  const [activeFilter, setActiveFilter] = useState<"pending" | "all" | "done" | "overdue">("pending");

  // Format date: YYYY-MM-DD -> YYYY년 M월 D일
  const formatTodoDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  };

  // Check if a todo is overdue
  const checkIsOverdue = (todo: Todo) => {
    if (todo.done || !todo.dueDate) return false;
    const due = new Date(todo.dueDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < new Date().getTime();
  };

  // Stats
  const totalCount = todos.length;
  const pendingCount = pendingTodos.length;
  const overdueCount = overdueTodos.length;

  // Filtered list
  const filteredTodos = useMemo(() => {
    switch (activeFilter) {
      case "all":
        return todos;
      case "done":
        return todos.filter((t) => t.done);
      case "overdue":
        return overdueTodos;
      case "pending":
      default:
        return pendingTodos;
    }
  }, [todos, pendingTodos, overdueTodos, activeFilter]);

  // Handle Add Todo submission
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    addTodo({
      text: text.trim(),
      priority,
      dueDate: dueDate || undefined,
      lectureId: lectureId === "none" ? undefined : lectureId,
    });

    setText("");
    setPriority("medium");
    setDueDate("");
    setLectureId("none");
    setShowAddForm(false);
    toast.success("할 일을 추가했습니다.");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" />
            할일 관리
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            강의 준비부터 사후 처리까지 할일을 관리하세요.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
          {showAddForm ? (
            <>
              <X className="mr-1.5 h-4 w-4" />
              닫기
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-4 w-4" />
              할일 추가
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {/* Total Stats */}
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex flex-col items-center justify-center rounded-xl border bg-card p-4 transition-all ${
            activeFilter === "all"
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
        >
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {totalCount}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">전체</span>
        </button>

        {/* Pending Stats */}
        <button
          onClick={() => setActiveFilter("pending")}
          className={`flex flex-col items-center justify-center rounded-xl border bg-card p-4 transition-all ${
            activeFilter === "pending"
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
        >
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {pendingCount}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">미완료</span>
        </button>

        {/* Overdue Stats */}
        <button
          onClick={() => setActiveFilter("overdue")}
          className={`flex flex-col items-center justify-center rounded-xl border bg-card p-4 transition-all ${
            activeFilter === "overdue"
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
        >
          <span className={`text-2xl font-bold tabular-nums ${overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>
            {overdueCount}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">기한 초과</span>
        </button>
      </div>

      {/* Add Todo Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddTodo}
          className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-foreground">새 할일 추가</h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="할일 내용을 입력하세요"
                className="w-full text-sm"
                required
                autoFocus
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Priority Select */}
              <div className="w-[120px]">
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as TodoPriority)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="우선순위" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        높음
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        보통
                      </span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        낮음
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Input */}
              <div className="relative flex-1 min-w-[140px]">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 text-sm pl-8"
                />
                <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>

              {/* Connected Lecture Select */}
              <div className="flex-1 min-w-[200px]">
                <select
                  value={lectureId}
                  onChange={(e) => setLectureId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-ring"
                >
                  <option value="none">연결 없음</option>
                  {lectures.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      {lec.title} ({lec.organization})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setText("");
              }}
            >
              취소
            </Button>
            <Button type="submit" size="sm" disabled={!text.trim()}>
              추가
            </Button>
          </div>
        </form>
      )}

      {/* Tabs Filter */}
      <div className="mb-4 bg-muted/60 p-1 rounded-lg flex gap-1">
        <button
          onClick={() => setActiveFilter("pending")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "pending" || activeFilter === "overdue"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          미완료
        </button>
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "all"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setActiveFilter("done")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "done"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          완료
        </button>
      </div>

      {/* Todo List */}
      <div className="space-y-2.5">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl bg-card">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">할 일이 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              새로운 할 일을 등록하여 일정을 관리해보세요.
            </p>
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const lecture = lectures.find((l) => l.id === todo.lectureId);
            const overdue = checkIsOverdue(todo);

            return (
              <div
                key={todo.id}
                className={`flex items-start justify-between gap-3 p-4 rounded-xl border bg-card transition-all ${
                  todo.done
                    ? "border-border/60 bg-muted/20 opacity-80"
                    : "border-border hover:shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Circle Checkbox */}
                  <button
                    onClick={() => {
                      toggleTodo(todo.id);
                      if (!todo.done) {
                        toast.success("할 일을 완료했습니다.");
                      }
                    }}
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      todo.done
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30 hover:border-primary bg-background"
                    }`}
                  >
                    {todo.done && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>

                  {/* Text and Badges */}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium text-foreground leading-snug break-words ${
                        todo.done ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {todo.text}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {/* Priority Badge */}
                      {todo.priority === "high" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          높음
                        </span>
                      )}
                      {todo.priority === "medium" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                          보통
                        </span>
                      )}
                      {todo.priority === "low" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          낮음
                        </span>
                      )}

                      {/* Connected Lecture Badge */}
                      {lecture && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium bg-blue-50/70 text-blue-600 border border-blue-100/60 truncate max-w-[180px]">
                          {lecture.title}
                        </span>
                      )}

                      {/* Due Date */}
                      {todo.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium ${
                            overdue
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {overdue && <AlertCircle className="h-3 w-3 stroke-[2.5]" />}
                          {formatTodoDate(todo.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => {
                    deleteTodo(todo.id);
                    toast.success("할 일을 삭제했습니다.");
                  }}
                  className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
