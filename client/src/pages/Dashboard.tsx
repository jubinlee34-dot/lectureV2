import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsModal } from "@/components/SmsModal";
import { useLectures } from "@/hooks/useLectures";
import { useTodos } from "@/hooks/useTodos";
import { formatDurationMin } from "@/services/naverRouteService";
import { recordSmsHistory } from "@/utils/storage";
import { formatDate, formatKRW } from "@/utils/format";
import { getStatusCounts, statusLabels } from "@/utils/lectureStatus";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture, Todo, TodoPriority } from "@/types/lecture";

type DashboardTodoDueState = "overdue" | "today" | "soon" | "future" | "none";

type DashboardTodoMeta = {
  dueKey: string;
  dueDiff: number | null;
  dueLabel: string;
  dueState: DashboardTodoDueState;
};

type ScheduleSummary = {
  remainingThisMonth: number;
  remainingThisWeek: number;
  nextWeek: number;
};

function getTodayDateKey() {
  const today = new Date();
  return formatLocalDate(today);
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

function normalizeDateKey(dateStr?: string | null) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getValidDateKey(dateStr?: string | null) {
  const key = normalizeDateKey(dateStr);
  const parts = parseDateParts(key);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day, 12);
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  ) {
    return "";
  }
  return key;
}

function toLocalDateTime(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12).getTime();
}

function toLocalDate(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12);
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number) {
  const date = toLocalDate(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function getDateDiffInDays(fromDateKey: string, toDateKey: string) {
  const fromTime = toLocalDateTime(fromDateKey);
  const toTime = toLocalDateTime(toDateKey);
  if (fromTime === null || toTime === null) return null;
  return Math.round((toTime - fromTime) / 86400000);
}

function formatMonthDay(dateStr?: string | null) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  return `${parts.month}월 ${parts.day}일`;
}

function countLecturesBetween(lectures: Lecture[], startKey: string, endKey: string) {
  return lectures.filter((lecture) => {
    const dateKey = getValidDateKey(lecture.date);
    return Boolean(dateKey) && dateKey >= startKey && dateKey <= endKey;
  }).length;
}

function buildScheduleSummary(lectures: Lecture[], todayKey: string): ScheduleSummary {
  const today = toLocalDate(todayKey);
  if (!today) return { remainingThisMonth: 0, remainingThisWeek: 0, nextWeek: 0 };

  const endOfMonthKey = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12));
  const daysUntilSunday = (7 - today.getDay()) % 7;
  const endOfThisWeekKey = addDays(todayKey, daysUntilSunday);
  const startOfNextWeekKey = addDays(todayKey, daysUntilSunday + 1);
  const endOfNextWeekKey = addDays(todayKey, daysUntilSunday + 7);

  return {
    remainingThisMonth: countLecturesBetween(lectures, todayKey, endOfMonthKey),
    remainingThisWeek: countLecturesBetween(lectures, todayKey, endOfThisWeekKey),
    nextWeek: countLecturesBetween(lectures, startOfNextWeekKey, endOfNextWeekKey),
  };
}

function getDashboardTodoMeta(todo: Todo, todayKey: string): DashboardTodoMeta {
  const dueKey = normalizeDateKey(todo.dueDate);
  if (!dueKey) {
    return { dueKey: "", dueDiff: null, dueLabel: "날짜 없음", dueState: "none" };
  }

  const dueDiff = getDateDiffInDays(todayKey, dueKey);
  const dateText = formatMonthDay(dueKey);
  if (dueDiff === null) {
    return { dueKey, dueDiff, dueLabel: dateText || "날짜 없음", dueState: "none" };
  }

  if (dueDiff < 0) {
    return { dueKey, dueDiff, dueLabel: `기한초과 ${Math.abs(dueDiff)}일 · ${dateText}`, dueState: "overdue" };
  }
  if (dueDiff === 0) {
    return { dueKey, dueDiff, dueLabel: `오늘 · ${dateText}`, dueState: "today" };
  }
  if (dueDiff <= 3) {
    return { dueKey, dueDiff, dueLabel: `D-${dueDiff} · ${dateText}`, dueState: "soon" };
  }
  return { dueKey, dueDiff, dueLabel: `D-${dueDiff} · ${dateText}`, dueState: "future" };
}

function getDashboardTodoSortBucket(todo: Todo, meta: DashboardTodoMeta) {
  if (meta.dueState === "overdue") return 0;
  if (meta.dueState === "today") return 1;
  if (meta.dueState === "soon") return 2;
  if (todo.priority === "high" && meta.dueState !== "none") return 3;
  if (meta.dueState === "future") return 4;
  return 5;
}

function sortDashboardTodos(todos: Todo[], todayKey: string) {
  return [...todos].sort((a, b) => {
    const aMeta = getDashboardTodoMeta(a, todayKey);
    const bMeta = getDashboardTodoMeta(b, todayKey);
    const bucketDiff = getDashboardTodoSortBucket(a, aMeta) - getDashboardTodoSortBucket(b, bMeta);
    if (bucketDiff !== 0) return bucketDiff;

    const aDue = aMeta.dueDiff ?? Number.MAX_SAFE_INTEGER;
    const bDue = bMeta.dueDiff ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;

    const priorityOrder: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return a.text.localeCompare(b.text, "ko");
  });
}

function getPriorityMeta(priority: TodoPriority) {
  switch (priority) {
    case "high":
      return { label: "높음", className: "bg-red-50 text-red-700 border-red-200", dotClassName: "bg-red-500" };
    case "low":
      return { label: "낮음", className: "bg-blue-50 text-blue-700 border-blue-200", dotClassName: "bg-blue-500" };
    case "medium":
    default:
      return { label: "보통", className: "bg-yellow-50 text-yellow-700 border-yellow-200", dotClassName: "bg-yellow-500" };
  }
}

function getDueBadgeClassName(state: DashboardTodoDueState) {
  switch (state) {
    case "overdue":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "today":
    case "soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "future":
      return "border-blue-100 bg-blue-50/70 text-blue-700";
    case "none":
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { lectures, stats, upcomingLectures } = useLectures();
  const { pendingTodos, toggleTodo } = useTodos();
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const [feeOpen, setFeeOpen] = useState(false);

  const todayKey = useMemo(() => getTodayDateKey(), []);
  const statusCounts = useMemo(() => getStatusCounts(lectures), [lectures]);
  const scheduleSummary = useMemo(() => buildScheduleSummary(lectures, todayKey), [lectures, todayKey]);

  const dashboardTodos = useMemo(() => {
    return sortDashboardTodos(pendingTodos, todayKey).slice(0, 3);
  }, [pendingTodos, todayKey]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">강의 일정과 전후 업무를 한눈에 확인합니다.</p>
        </div>
        <Button size="sm" onClick={() => navigate("/lectures/new")} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" />
          강의 등록
        </Button>
      </div>

      <StatusSummaryBar counts={statusCounts} />

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <ScheduleSummaryCard summary={scheduleSummary} />
          <section className="self-start rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setFeeOpen((open) => !open)}
              aria-expanded={feeOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-none bg-transparent text-left text-sm font-semibold text-foreground outline-none cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-primary" />
                이번 달 강사료 현황
              </span>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {feeOpen ? "금액 숨기기 ▲" : "금액 보기 ▼"}
              </span>
            </button>
            {feeOpen && (
              <div className="mt-4 grid gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <MoneyBox label="지급 예정" value={formatKRW(stats.thisMonthFee)} />
                <MoneyBox label="지급 완료" value={formatKRW(stats.thisMonthPaid)} tone="green" />
                <MoneyBox label="미지급" value={formatKRW(stats.thisMonthUnpaid)} tone="red" />
              </div>
            )}
          </section>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                다가오는 강의
              </h2>
              <button onClick={() => navigate("/calendar")} className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
                캘린더 <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {upcomingLectures.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">예정된 강의가 없습니다.</div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingLectures.slice(0, 5).map((lecture, index) => {
                  const lectureDateKey = getValidDateKey(lecture.date);
                  const daysLeft = Math.max(0, getDateDiffInDays(todayKey, lectureDateKey) ?? 0);
                  const location = lecture.location?.trim();
                  const organization = lecture.organization?.trim();
                  const dateAndOrganization = [formatDate(lecture.date), organization].filter(Boolean).join(" · ");

                  return (
                    <div key={lecture.id} className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
                      <div className={`flex h-9 min-w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-bold ${daysLeft <= 3 ? "bg-red-100 text-red-700" : daysLeft <= 7 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                        {daysLeft === 0 ? "오늘" : `D-${daysLeft}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/lectures/${lecture.id}`)}>
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="min-w-0 truncate text-sm font-medium text-foreground">{lecture.title}</p>
                              {index === 0 && <Badge className="h-5 shrink-0 text-[9px]">NEXT</Badge>}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{dateAndOrganization}</p>
                          </button>
                          {lecture.managerPhone && (
                            <div className="flex shrink-0 items-center gap-1 sm:justify-end">
                              <button
                                onClick={() => setSmsTarget(lecture)}
                                className="inline-flex h-7 items-center gap-1 rounded-md bg-green-500 px-2 text-[11px] text-white hover:bg-green-600 border-none outline-none cursor-pointer"
                              >
                                <MessageCircle className="h-3 w-3" />문자
                              </button>
                              <a className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600" href={`tel:${lecture.managerPhone}`}>
                                <Phone className="h-3 w-3" />전화
                              </a>
                            </div>
                          )}
                        </div>
                        {(location || lecture.travelDurationMin) && (
                          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                            {location && (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{location}</span>
                              </span>
                            )}
                            {location && lecture.travelDurationMin ? <span className="text-muted-foreground/60">·</span> : null}
                            {lecture.travelDurationMin ? (
                              <span className="whitespace-nowrap">
                                이동시간 {formatDurationMin(lecture.travelDurationMin)}
                                {!lecture.travelUpdatedAt ? " · 재계산 필요" : ""}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                할 일
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white tabular-nums">
                  {pendingTodos.length}
                </span>
              </h2>
              <button
                onClick={() => navigate("/todos")}
                className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-primary cursor-pointer border-none bg-transparent"
              >
                전체 <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {pendingTodos.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">진행 중인 할 일이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {dashboardTodos.map((todo) => {
                  const priorityMeta = getPriorityMeta(todo.priority);
                  const dueMeta = getDashboardTodoMeta(todo, todayKey);
                  return (
                    <div key={todo.id} className="flex min-w-0 flex-col gap-1.5 rounded-lg px-1 py-1 sm:flex-row sm:items-center sm:gap-2">
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            toggleTodo(todo.id);
                            toast.success("할 일을 완료했습니다.");
                          }}
                          aria-label="할 일을 완료로 변경"
                          title="완료"
                          className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 hover:border-primary bg-background cursor-pointer"
                        >
                          <Check className="h-3 w-3 text-primary scale-0 transition-transform" />
                        </button>

                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityMeta.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dotClassName}`} />
                          {priorityMeta.label}
                        </span>

                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getDueBadgeClassName(dueMeta.dueState)}`}>
                          {dueMeta.dueLabel}
                        </span>
                      </div>

                      <span title={todo.text} className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground">
                        {todo.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={smsTarget.workflowStage === "after" ? "thankyou" : "reminder"}
          onRecord={(type, recipient, content) => {
            recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 이력을 기록했습니다.");
          }}
        />
      )}
    </div>
  );
}

function StatusSummaryBar({ counts }: { counts: ReturnType<typeof getStatusCounts> }) {
  return (
    <section className="rounded-xl border border-border bg-card px-3 py-3">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:gap-0">
        <StatusSummaryItem label="전체" value={counts.all} />
        <StatusSummaryItem label={statusLabels.before} value={counts.before} />
        <StatusSummaryItem label={statusLabels.after} value={counts.after} />
        <StatusSummaryItem label={statusLabels.promoted} value={counts.promoted} last />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">※ 전체 기간 기준</p>
    </section>
  );
}

function StatusSummaryItem({ label, value, last = false }: { label: string; value: number; last?: boolean }) {
  return (
    <span className={`min-w-0 ${last ? "" : "sm:after:mx-3 sm:after:text-border sm:after:content-['|']"}`}>
      <span>{label}</span> <strong className="font-bold text-foreground tabular-nums">{value}</strong>
    </span>
  );
}

function ScheduleSummaryCard({ summary }: { summary: ScheduleSummary }) {
  return (
    <section className="self-start rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" />
        일정 요약
      </h2>
      <div className="space-y-2">
        <ScheduleSummaryRow label="이번 달 남은 일정" value={summary.remainingThisMonth} />
        <ScheduleSummaryRow label="이번 주 일정" value={summary.remainingThisWeek} />
        <ScheduleSummaryRow label="다음 주 일정" value={summary.nextWeek} />
      </div>
    </section>
  );
}

function ScheduleSummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-base font-bold text-foreground tabular-nums">{value}</strong>
    </div>
  );
}

function MoneyBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700 bg-green-50" : tone === "red" ? "text-red-700 bg-red-50" : "text-foreground bg-muted/50";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${color}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}