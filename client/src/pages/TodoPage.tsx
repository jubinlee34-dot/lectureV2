import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLectures } from "@/hooks/useLectures";
import { useTodos } from "@/hooks/useTodos";
import type { Lecture, Todo, TodoPriority } from "@/types/lecture";
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

const NO_LECTURE_VALUE = "none";
const NO_DATE_GROUP = "날짜 미정";

type LectureGroup = {
  label: string;
  lectures: Lecture[];
};

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateParts(dateStr?: string | null) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return null;
  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (!yearNum || !monthNum || !dayNum) return null;
  return { year: yearNum, month: monthNum, day: dayNum };
}

function formatKoreanDate(dateStr?: string | null) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  return `${parts.year}년 ${parts.month}월 ${parts.day}일`;
}

function formatShortDate(dateStr?: string | null) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  return `${parts.year}.${String(parts.month).padStart(2, "0")}.${String(parts.day).padStart(2, "0")}`;
}

function normalizeDateKey(dateStr?: string | null) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatLectureLabel(lecture: Lecture, includeDate = true) {
  const date = includeDate ? formatShortDate(lecture.date) : "";
  const title = lecture.title || "강의명 없음";
  const organization = lecture.organization?.trim();
  return [date || (includeDate ? NO_DATE_GROUP : ""), title, organization].filter(Boolean).join(" · ");
}

function compareLecturesInSameDate(a: Lecture, b: Lecture) {
  const aTime = a.startTime?.trim() || "";
  const bTime = b.startTime?.trim() || "";
  if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
  if (aTime && !bTime) return -1;
  if (!aTime && bTime) return 1;
  return (a.title || "").localeCompare(b.title || "", "ko");
}

function createLectureGroups(lectures: Lecture[], todayKey: string): LectureGroup[] {
  const dated = lectures.filter((lecture) => normalizeDateKey(lecture.date));
  const undated = lectures
    .filter((lecture) => !normalizeDateKey(lecture.date))
    .sort((a, b) => compareLecturesInSameDate(a, b));

  const upcoming = dated
    .filter((lecture) => normalizeDateKey(lecture.date) >= todayKey)
    .sort((a, b) => {
      const dateCompare = normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date));
      return dateCompare || compareLecturesInSameDate(a, b);
    });

  const past = dated
    .filter((lecture) => normalizeDateKey(lecture.date) < todayKey)
    .sort((a, b) => {
      const dateCompare = normalizeDateKey(b.date).localeCompare(normalizeDateKey(a.date));
      return dateCompare || compareLecturesInSameDate(a, b);
    });

  const groupsByDate = new Map<string, Lecture[]>();
  [...upcoming, ...past].forEach((lecture) => {
    const dateKey = normalizeDateKey(lecture.date);
    const current = groupsByDate.get(dateKey) || [];
    current.push(lecture);
    groupsByDate.set(dateKey, current);
  });

  const groups = Array.from(groupsByDate.entries()).map(([dateKey, groupLectures]) => ({
    label: formatKoreanDate(dateKey),
    lectures: groupLectures,
  }));

  if (undated.length > 0) {
    groups.push({ label: NO_DATE_GROUP, lectures: undated });
  }

  return groups;
}

function LectureSelectOptions({ groups }: { groups: LectureGroup[] }) {
  return (
    <>
      <option value={NO_LECTURE_VALUE}>연결 없음</option>
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.lectures.map((lecture) => (
            <option key={lecture.id} value={lecture.id}>
              {formatLectureLabel(lecture)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

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
  const [lectureId, setLectureId] = useState<string>(NO_LECTURE_VALUE);
  const [activeFilter, setActiveFilter] = useState<"pending" | "all" | "done" | "overdue">("pending");

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingPriority, setEditingPriority] = useState<TodoPriority>("medium");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingLectureId, setEditingLectureId] = useState<string>(NO_LECTURE_VALUE);

  const todayKey = useMemo(() => getTodayDateKey(), []);
  const lectureGroups = useMemo(() => createLectureGroups(lectures, todayKey), [lectures, todayKey]);

  const checkIsOverdue = (todo: Todo) => {
    const dateKey = normalizeDateKey(todo.dueDate);
    if (todo.done || !dateKey) return false;
    return dateKey < todayKey;
  };

  const totalCount = todos.length;
  const pendingCount = pendingTodos.length;
  const overdueCount = overdueTodos.length;

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

  const isAllSelected = filteredTodos.length > 0 && selectedIds.length === filteredTodos.length;

  const handleToggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : filteredTodos.map((t) => t.id));
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
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

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingText(todo.text);
    setEditingPriority(todo.priority);
    setEditingDueDate(todo.dueDate || "");
    setEditingLectureId(todo.lectureId || NO_LECTURE_VALUE);
  };

  const saveEdit = () => {
    if (!editingId || !editingText.trim()) return;
    updateTodo(editingId, {
      text: editingText.trim(),
      priority: editingPriority,
      dueDate: editingDueDate || undefined,
      lectureId: editingLectureId === NO_LECTURE_VALUE ? undefined : editingLectureId,
    });
    setEditingId(null);
    toast.success("할 일을 수정했습니다.");
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    addTodo({
      text: text.trim(),
      priority,
      dueDate: dueDate || undefined,
      lectureId: lectureId === NO_LECTURE_VALUE ? undefined : lectureId,
    });

    setText("");
    setPriority("medium");
    setDueDate("");
    setLectureId(NO_LECTURE_VALUE);
    setShowAddForm(false);
    toast.success("할 일을 추가했습니다.");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" />
            할 일 관리
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            강의 준비부터 사후 처리까지 할 일을 관리해보세요.
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
              할 일 추가
            </>
          )}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex flex-col items-center justify-center rounded-xl border bg-card p-4 transition-all ${
            activeFilter === "all"
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
        >
          <span className="text-2xl font-bold text-foreground tabular-nums">{totalCount}</span>
          <span className="mt-1 text-xs text-muted-foreground">전체</span>
        </button>

        <button
          onClick={() => setActiveFilter("pending")}
          className={`flex flex-col items-center justify-center rounded-xl border bg-card p-4 transition-all ${
            activeFilter === "pending"
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
          }`}
        >
          <span className="text-2xl font-bold text-foreground tabular-nums">{pendingCount}</span>
          <span className="mt-1 text-xs text-muted-foreground">미완료</span>
        </button>

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

      {showAddForm && (
        <form onSubmit={handleAddTodo} className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-foreground">새 할 일 추가</h2>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="할 일 내용을 입력하세요"
              className="w-full text-sm"
              required
              autoFocus
            />

            <div className="flex flex-wrap items-start gap-3">
              <div className="w-[120px]">
                <Select value={priority} onValueChange={(val) => setPriority(val as TodoPriority)}>
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

              <div className="min-w-[160px] flex-1 space-y-1">
                <label htmlFor="todo-due-date" className="text-xs font-semibold text-foreground">
                  마감일
                </label>
                <div className="relative">
                  <Input
                    id="todo-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    aria-label="마감일"
                    title="이 할 일을 완료해야 하는 날짜"
                    className="h-10 text-sm pl-8"
                  />
                  <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-[11px] text-muted-foreground">이 할 일을 완료해야 하는 날짜</p>
              </div>

              <div className="min-w-[220px] flex-1 space-y-1">
                <label htmlFor="todo-lecture" className="text-xs font-semibold text-foreground">
                  연결 강의
                </label>
                <select
                  id="todo-lecture"
                  value={lectureId}
                  onChange={(e) => setLectureId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-ring"
                >
                  <LectureSelectOptions groups={lectureGroups} />
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

      <div className="mb-4 bg-muted/60 p-1 rounded-lg flex gap-1">
        <button
          onClick={() => setActiveFilter("pending")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "pending" || activeFilter === "overdue" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          미완료
        </button>
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setActiveFilter("done")}
          className={`flex-1 py-1.5 text-center text-xs sm:text-sm font-medium rounded-md transition-all ${
            activeFilter === "done" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          완료
        </button>
      </div>

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
              전체 선택 ({filteredTodos.length}개 중 {selectedIds.length}개 선택)
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

      <div className="space-y-2.5">
        {filteredTodos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl bg-card">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">할 일이 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-0.5">새로운 할 일을 등록하여 일정을 관리해보세요.</p>
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const lecture = lectures.find((l) => l.id === todo.lectureId);
            const overdue = checkIsOverdue(todo);
            const isEditing = editingId === todo.id;
            const dueDateText = formatKoreanDate(todo.dueDate);

            if (isEditing) {
              return (
                <div key={todo.id} className="p-4 rounded-xl border border-primary bg-card shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    <span className="text-xs font-semibold text-primary">할 일 수정</span>
                    <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      placeholder="할 일 내용을 입력하세요"
                      className="w-full text-sm"
                    />
                    <div className="flex flex-wrap items-start gap-3">
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

                      <div className="min-w-[160px] flex-1 space-y-1">
                        <label htmlFor={`edit-due-date-${todo.id}`} className="text-xs font-semibold text-foreground">
                          마감일
                        </label>
                        <div className="relative">
                          <Input
                            id={`edit-due-date-${todo.id}`}
                            type="date"
                            value={editingDueDate}
                            onChange={(e) => setEditingDueDate(e.target.value)}
                            aria-label="마감일"
                            title="이 할 일을 완료해야 하는 날짜"
                            className="h-10 text-sm pl-8"
                          />
                          <Calendar className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">이 할 일을 완료해야 하는 날짜</p>
                      </div>

                      <div className="min-w-[220px] flex-1 space-y-1">
                        <label htmlFor={`edit-lecture-${todo.id}`} className="text-xs font-semibold text-foreground">
                          연결 강의
                        </label>
                        <select
                          id={`edit-lecture-${todo.id}`}
                          value={editingLectureId}
                          onChange={(e) => setEditingLectureId(e.target.value)}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:ring-1 focus:ring-ring"
                        >
                          <LectureSelectOptions groups={lectureGroups} />
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-border pt-2.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                    <Button type="button" size="sm" onClick={saveEdit} disabled={!editingText.trim()}>
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
                  todo.done ? "border-border/60 bg-muted/20 opacity-80" : "border-border hover:shadow-xs"
                } ${selectedIds.includes(todo.id) ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex items-center shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(todo.id)}
                      onChange={(e) => handleSelect(todo.id, e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => {
                      toggleTodo(todo.id);
                      if (!todo.done) {
                        toast.success("할 일을 완료했습니다.");
                      }
                    }}
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      todo.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary bg-background"
                    }`}
                  >
                    {todo.done && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium text-foreground leading-snug break-words ${todo.done ? "line-through text-muted-foreground" : ""}`}>
                      {todo.text}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
                    </div>

                    <div className="mt-2 grid gap-1 text-[11px] sm:text-xs">
                      {lecture && (
                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-muted-foreground">
                          <span className="font-semibold text-foreground/70">관련 강의</span>
                          <span className="min-w-0 break-words">{formatLectureLabel(lecture)}</span>
                        </div>
                      )}
                      <div
                        className={`grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 ${
                          overdue ? "text-destructive font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground/70">
                          {overdue && <AlertCircle className="h-3 w-3 stroke-[2.5] text-destructive" />}
                          마감일
                        </span>
                        <span>{dueDateText || "없음"}</span>
                      </div>
                    </div>
                  </div>
                </div>

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
