import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmsModal } from "@/components/SmsModal";
import { useLectures } from "@/hooks/useLectures";
import { useTodos } from "@/hooks/useTodos";
import { formatDurationMin } from "@/services/naverRouteService";
import { recordSmsHistory } from "@/utils/storage";
import { formatDate, formatKRW } from "@/utils/format";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { Lecture, Todo, TodoPriority } from "@/types/lecture";

const stageLabels: Record<string, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

const stageStyles: Record<string, string> = {
  before: "bg-blue-50 text-blue-700 border-blue-200",
  after: "bg-amber-50 text-amber-700 border-amber-200",
  promoted: "bg-green-50 text-green-700 border-green-200",
};


type DashboardTodoDueState = "overdue" | "today" | "soon" | "future" | "none";

type DashboardTodoMeta = {
  dueKey: string;
  dueDiff: number | null;
  dueLabel: string;
  dueState: DashboardTodoDueState;
};

function getTodayDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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

function toLocalDateTime(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12).getTime();
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

  const beforeCount = lectures.filter((lecture) => lecture.workflowStage === "before").length;
  const afterCount = lectures.filter((lecture) => lecture.workflowStage === "after").length;
  const promotedCount = lectures.filter((lecture) => lecture.workflowStage === "promoted").length;

  const recentLectures = useMemo(() => {
    return [...lectures]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [lectures]);

  const dashboardTodos = useMemo(() => {
    return sortDashboardTodos(pendingTodos, getTodayDateKey()).slice(0, 3);
  }, [pendingTodos]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">강의 일정과 전후 업무를 한눈에 확인합니다.</p>
        </div>
        <Button size="sm" onClick={() => navigate("/lectures/new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          강의 등록
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<BookOpen className="h-5 w-5 text-blue-600" />} label="총 강의" value={`${stats.totalCount}개`} onClick={() => navigate("/lectures")} />
        <StatCard icon={<Users className="h-5 w-5 text-violet-600" />} label="총 참여자" value={`${stats.totalParticipants.toLocaleString()}명`} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="올해 강의" value={`${stats.currentYearCount}개`} />
        <StatCard icon={<CalendarDays className="h-5 w-5 text-amber-600" />} label="예정 강의" value={`${stats.upcomingCount}건`} onClick={() => navigate("/calendar")} />
      </div>


      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              다가오는 강의
            </h2>
            <button onClick={() => navigate("/calendar")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
              캘린더 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {upcomingLectures.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">예정된 강의가 없습니다.</div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingLectures.slice(0, 5).map((lecture, index) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(lecture.date).getTime() - new Date().getTime()) / 86400000)
                );
                return (
                  <div key={lecture.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${daysLeft <= 3 ? "bg-red-100 text-red-700" : daysLeft <= 7 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      <span className="text-[10px] font-medium">{daysLeft === 0 ? "오늘" : "D-"}</span>
                      {daysLeft > 0 && <span className="text-sm font-bold">{daysLeft}</span>}
                    </div>
                    <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/lectures/${lecture.id}`)}>
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">{lecture.title}</p>
                        {index === 0 && <Badge className="h-5 text-[9px]">NEXT</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{lecture.organization} · {formatDate(lecture.date)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {lecture.location}
                      </p>
                      {lecture.travelDurationMin ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          🚗 저장된 이동시간 {formatDurationMin(lecture.travelDurationMin)}
                          {!lecture.travelUpdatedAt ? " · 재계산 필요" : ""}
                        </p>
                      ) : null}
                    </button>
                    {lecture.managerPhone && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => setSmsTarget(lecture)}
                          className="flex items-center gap-1 rounded-md bg-green-500 px-2 py-1 text-[11px] text-white hover:bg-green-600 border-none outline-none cursor-pointer"
                        >
                          <MessageCircle className="h-3 w-3" />문자
                        </button>
                        <a className="flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-[11px] text-white hover:bg-blue-600" href={`tel:${lecture.managerPhone}`}>
                          <Phone className="h-3 w-3" />전화
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            진행 단계
          </h2>
          <div className="space-y-2">
            <WorkflowRow label="강의 전" count={beforeCount} total={lectures.length} color="bg-blue-500" onClick={() => navigate("/calendar?status=before")} />
            <WorkflowRow label="강의 후" count={afterCount} total={lectures.length} color="bg-amber-500" onClick={() => navigate("/calendar?status=after")} />
            <WorkflowRow label="홍보 완료" count={promotedCount} total={lectures.length} color="bg-green-500" onClick={() => navigate("/calendar?status=promoted")} />
          </div>
        </section>
      </div>

      {/* 할일 & 최근 등록 강의 Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 할일 Section */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
              할일
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white tabular-nums">
                {pendingTodos.length}
              </span>
            </h2>
            <button
              onClick={() => navigate("/todos")}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary cursor-pointer border-none bg-transparent"
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
                const dueMeta = getDashboardTodoMeta(todo, getTodayDateKey());
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

        {/* 최근 등록 강의 Section */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <BookOpen className="h-4.5 w-4.5 text-blue-600" />
              최근 등록 강의
            </h2>
            <button
              onClick={() => navigate("/lectures")}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary cursor-pointer border-none bg-transparent"
            >
              전체 보기 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentLectures.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">등록된 강의가 없습니다.</div>
          ) : (
            <div className="space-y-2.5">
              {recentLectures.map((lecture) => (
                <button
                  key={lecture.id}
                  onClick={() => navigate(`/lectures/${lecture.id}`)}
                  className="w-full rounded-lg border border-border/80 p-3 flex items-center justify-between gap-3 hover:border-primary/40 text-left cursor-pointer transition-colors bg-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground leading-snug">
                      {lecture.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lecture.organization} · {formatDate(lecture.date)}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 border ${stageStyles[lecture.workflowStage]}`}>
                    {stageLabels[lecture.workflowStage]}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 강사료 현황 토글 */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <button
          onClick={() => setFeeOpen((open) => !open)}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground cursor-pointer border-none bg-transparent outline-none"
        >
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-primary" />
            이번 달 강사료 현황
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {feeOpen ? "접기 ▲" : "펼치기 ▼"}
          </span>
        </button>
        {feeOpen && (
          <div className="mt-4 grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <MoneyBox label="총 강사료" value={formatKRW(stats.thisMonthFee)} />
            <MoneyBox label="입금 완료" value={formatKRW(stats.thisMonthPaid)} tone="green" />
            <MoneyBox label="미입금" value={formatKRW(stats.thisMonthUnpaid)} tone="red" />
          </div>
        )}
      </div>

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={smsTarget.workflowStage === "after" ? "thankyou" : "reminder"}
          onRecord={(type, recipient, content) => {
            recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 내역을 기록했습니다.");
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl border border-border bg-card p-3 text-left ${onClick ? "hover:border-primary/40" : "cursor-default"}`}>
      <div className="mb-2">{icon}</div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function MoneyBox({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700 bg-green-50" : tone === "red" ? "text-red-700 bg-red-50" : "text-foreground bg-muted/50";
  return (
    <div className={`rounded-lg p-3 text-center ${color}`}>
      <p className="mb-1 text-xs">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function WorkflowRow({ label, count, total, color, onClick }: { label: string; count: number; total: number; color: string; onClick: () => void }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button onClick={onClick} className="w-full rounded-lg border border-border p-3 text-left hover:border-primary/40">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}건</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

