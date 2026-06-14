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
  Pencil,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    updateTodo,
    bulkDeleteTodos,
    bulkUpdateTodos,
  } = useTodos();

  const [showAddForm, setShowAddForm] = useState(false);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [lectureId, setLectureId] = useState<string>("none");
  const [activeFilter, setActiveFilter] = useState<"pending" | "all" | "done" | "overdue">("pending");

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingPriority, setEditingPriority] = useState<TodoPriority>("medium");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingLectureId, setEditingLectureId] = useState<string>("none");

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

  // 필터 변경 시 선택 항목 초기화
  useEffect(() => {
    setSelectedIds([]);
  }, [activeFilter, selectedYear, selectedMonth]);

  const getTodoDateParts = (todo: Todo) => {
    const targetDate = todo.dueDate || todo.createdAt.split("T")[0];
    const parts = targetDate.split("-");
    return {
      year: parts[0] || "none",
      month: parts[1] ? Number(parts[1]).toString() : "none",
    };
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    todos.forEach((todo) => {
      const { year } = getTodoDateParts(todo);
      if (year && year.length === 4) years.add(year);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [todos]);

  // Filtered list
  const filteredTodos = useMemo(() => {
    let list = todos;
    switch (activeFilter) {
      case "all":
        list = todos;
        break;
      case "done":
        list = todos.filter((t) => t.done);
        break;
      case "overdue":
        list = overdueTodos;
        break;
      case "pending":
      default:
        list = pendingTodos;
        break;
    }

    return list.filter((todo) => {
      const { year, month } = getTodoDateParts(todo);
      const yearMatch = selectedYear === "all" || year === selectedYear;
      const monthMatch = selectedMonth === "all" || month === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [todos, pendingTodos, overdueTodos, activeFilter, selectedYear, selectedMonth]);

  // Checkbox functions
  const isAllSelected = filteredTodos.length > 0 && selectedIds.length === filteredTodos.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTodos.map((t) => t.id));
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`선택한 ${selectedIds.length}개의 할 일을 삭제하시겠습니까?`);
    if (confirmed) {
      bulkDeleteTodos(selectedIds);
      setSelectedIds([]);
      toast.success(`${selectedIds.length}개의 할 일을 삭제했습니다.`);
    }
  };

  const handleBulkComplete = (done: boolean) => {
    if (selectedIds.length === 0) return;
    bulkUpdateTodos(selectedIds, { done });
    setSelectedIds([]);
    toast.success(`${selectedIds.length}개의 할 일을 ${done ? "완료" : "미완료"} 처리했습니다.`);
  };

  // Inline edit functions
  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingText(todo.text);
    setEditingPriority(todo.priority);
    setEditingDueDate(todo.dueDate || "");
    setEditingLectureId(todo.lectureId || "none");
  };

  const saveEdit = () => {
    if (!editingText.trim()) return;
    updateTodo(editingId!, {
      text: editingText.trim(),
      priority: editingPriority,
      dueDate: editingDueDate || undefined,
      lectureId: editingLectureId === "none" ? undefined : editingLectureId,
    });
    setEditingId(null);
    toast.success("할 일을 수정했습니다.");
  };

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

      {/* Year/Month Filters */}
      {todos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">전체 연도</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">전체 월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month.toString()}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {filteredTodos.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <span className="font-semibold text-foreground/80">
              전체 선택 ({filteredTodos.length}개 중 {selectedIds.length}개 선택됨)
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkComplete(true)}
                className="flex items-center gap-1 rounded border border-primary/20 bg-background px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-colors"
              >
                <Check className="h-3 w-3" />
                선택 완료
              </button>
              <button
                type="button"
                onClick={() => handleBulkComplete(false)}
                className="flex items-center gap-1 rounded border border-amber-200 bg-background px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
              >
                <X className="h-3 w-3" />
                선택 미완료
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 rounded border border-destructive/20 bg-background px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/5 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                선택 삭제
              </button>
            </div>
          )}
        </div>
      )}

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
            const isEditing = editingId === todo.id;

            if (isEditing) {
              return (
                <div
                  key={todo.id}
                  className="p-4 rounded-xl border border-primary bg-card shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-semibold text-primary">할 일 수정</span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      placeholder="할일 내용을 입력하세요"
                      className="w-full text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Priority Select */}
                      <div className="w-[120px]">
                        <select
                          value={editingPriority}
                          onChange={(e) => setEditingPriority(e.target.value as TodoPriority)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-ring"
                        >
                          <option value="high">높음</option>
                          <option value="medium">보통</option>
                          <option value="low">낮음</option>
                        </select>
                      </div>

                      {/* Date Input */}
                      <div className="relative flex-1 min-w-[140px]">
                        <Input
                          type="date"
                          value={editingDueDate}
                          onChange={(e) => setEditingDueDate(e.target.value)}
                          className="h-10 text-sm pl-8"
                        />
                        <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>

                      {/* Connected Lecture Select */}
                      <div className="flex-1 min-w-[200px]">
                        <select
                          value={editingLectureId}
                          onChange={(e) => setEditingLectureId(e.target.value)}
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
                  <div className="flex justify-end gap-2 border-t border-border pt-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveEdit}
                      disabled={!editingText.trim()}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={todo.id}
                className={`flex items-start justify-between gap-3 p-4 rounded-xl border bg-card transition-all ${
                  todo.done
                    ? "border-border/60 bg-muted/20 opacity-80"
                    : "border-border hover:shadow-xs"
                } ${selectedIds.includes(todo.id) ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Select Checkbox */}
                  <div className="flex items-center shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(todo.id)}
                      onChange={(e) => handleSelect(todo.id, e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

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
                  <div className="min-w-0 flex-1">
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

                {/* Actions (Edit and Delete) */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => startEdit(todo)}
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      deleteTodo(todo.id);
                      toast.success("할 일을 삭제했습니다.");
                    }}
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
