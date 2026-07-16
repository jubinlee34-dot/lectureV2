import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ImportModal } from "@/components/ImportModal";
import { LectureContactSummary } from "@/components/ContactLogSummary";
import { LectureActionDrawer, type LectureActionMode } from "@/components/LectureActionDrawer";
import { NaverRouteButton } from "@/components/NaverRouteButton";
import { SmsModal } from "@/components/SmsModal";
import { StatusNavigation } from "@/components/StatusNavigation";
import { TravelRouteSummary } from "@/components/TravelRouteSummary";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture } from "@/types/lecture";
import { hasAfterRecord } from "@/utils/afterRecord";
import { downloadCSV, downloadICS } from "@/utils/exportUtils";
import { getPreviousWorkflowStage, getStatusCounts, statusBadgeClass, type LectureStatusFilter, statusLabels } from "@/utils/lectureStatus";
import { recordSmsHistory } from "@/utils/storage";
import { BarChart3, Calendar, Clock, Download, PenLine, Sheet, Upload, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

type AudienceKind = "adult" | "youth" | "unknown";

interface MonthStats {
  month: number;
  lectures: Lecture[];
  totalHours: number;
  totalParticipants: number;
  adultParticipants: number;
  youthParticipants: number;
  unknownParticipants: number;
  hasEstimatedAudience: boolean;
  counts: ReturnType<typeof getStatusCounts>;
}

const monthNames = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);

export default function LectureList() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { lectures, deleteLecture, bulkAddLectures, updateLecture } = useLectures();
  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<LectureStatusFilter>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [actionLectureId, setActionLectureId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<LectureActionMode | null>(null);
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);
  const querySelectedLectureId = useMemo(() => new URLSearchParams(search).get("selectedLectureId"), [search]);
  const queryActionMode = useMemo(() => {
    const mode = new URLSearchParams(search).get("action");
    return mode === "edit" ? "edit" : "detail";
  }, [search]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    lectures.forEach((lecture) => {
      const year = lecture.date?.slice(0, 4);
      if (year?.match(/^\d{4}$/)) years.add(year);
    });
    if (years.size === 0) years.add(currentYear);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [lectures, currentYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) setSelectedYear(availableYears[0]);
  }, [availableYears, selectedYear]);

  const yearLectures = useMemo(
    () => lectures.filter((lecture) => lecture.date?.slice(0, 4) === selectedYear),
    [lectures, selectedYear]
  );
  const yearStatusCounts = useMemo(() => getStatusCounts(yearLectures), [yearLectures]);
  const monthStats = useMemo(
    () =>
      monthNames.map((_, index) => {
        const month = index + 1;
        const monthLectures = yearLectures.filter((lecture) => Number(lecture.date?.slice(5, 7)) === month);
        return buildMonthStats(month, monthLectures);
      }),
    [yearLectures]
  );

  const selectedMonthStats = monthStats[selectedMonth - 1];

  useEffect(() => {
    if (!querySelectedLectureId) return;
    const lecture = lectures.find((item) => item.id === querySelectedLectureId);
    if (!lecture) return;

    const year = lecture.date?.slice(0, 4);
    const month = Number(lecture.date?.slice(5, 7));
    if (year?.match(/^\d{4}$/)) setSelectedYear(year);
    if (month >= 1 && month <= 12) setSelectedMonth(month);
    setActionLectureId(lecture.id);
    setActionMode(queryActionMode);
  }, [lectures, queryActionMode, querySelectedLectureId]);

  const selectedMonthLectures = useMemo(() => {
    const base =
      statusFilter === "all"
        ? selectedMonthStats.lectures
        : selectedMonthStats.lectures.filter((lecture) => lecture.workflowStage === statusFilter);

    return [...base].sort((a, b) => {
      if (statusFilter === "before") return compareBeforeLectures(a, b, todayStr);
      return b.date.localeCompare(a.date);
    });
  }, [selectedMonthStats, statusFilter, todayStr]);

  const exportLectures = statusFilter === "all" ? yearLectures : yearLectures.filter((lecture) => lecture.workflowStage === statusFilter);
  const showMonthlyDashboard = statusFilter === "all";
  const selectedStatusLabel = statusFilter === "all" ? "전체 상태" : statusLabels[statusFilter];

  const openLectureAction = (lecture: Lecture, mode: LectureActionMode) => {
    setActionLectureId(lecture.id);
    setActionMode(mode);
  };

  const closeLectureAction = (open: boolean) => {
    if (open) return;
    setActionLectureId(null);
    setActionMode(null);
    if (querySelectedLectureId) navigate("/lectures", { replace: true });
  };

  const promoteLecture = async (lecture: Lecture) => {
    if (!lecture.blogUrl?.trim()) {
      const confirmed = window.confirm("블로그 URL이 비어 있습니다. 그래도 홍보 완료로 처리할까요?");
      if (!confirmed) return;
    }
    await updateLecture(lecture.id, { workflowStage: "promoted", blogWritten: lecture.blogWritten || Boolean(lecture.blogUrl?.trim()) });
    toast.success("홍보 완료 상태로 변경했습니다.");
  };

  const rollbackLecture = async (lecture: Lecture) => {
    const previousStage = getPreviousWorkflowStage(lecture.workflowStage);
    if (!previousStage) return;
    const confirmed = window.confirm(`${statusLabels[lecture.workflowStage]} 상태를 ${statusLabels[previousStage]} 상태로 되돌릴까요?`);
    if (!confirmed) return;
    await updateLecture(lecture.id, { workflowStage: previousStage });
    toast.success(`${statusLabels[previousStage]} 상태로 되돌렸습니다.`);
  };

  const handleDelete = (id: string) => {
    const lecture = lectures.find((item) => item.id === id);
    if (lecture) setDeleteTarget({ id, title: lecture.title });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">강의목록</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">월별 강의 기록과 통계를 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearSelect selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="hidden lg:inline-flex">
            <Upload className="mr-1.5 h-4 w-4 text-blue-600" />
            가져오기
          </Button>
          {yearLectures.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCSV(exportLectures, `강의목록-${selectedYear}.csv`);
                  toast.success("CSV 파일을 다운로드했습니다.");
                }}
                className="hidden lg:inline-flex"
              >
                <Sheet className="mr-1.5 h-4 w-4 text-green-600" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadICS(exportLectures, `강의일정-${selectedYear}.ics`);
                  toast.success("ICS 파일을 다운로드했습니다.");
                }}
                className="hidden lg:inline-flex"
              >
                <Download className="mr-1.5 h-4 w-4 text-blue-600" />
                ICS
              </Button>
            </>
          )}
          <Button onClick={() => navigate("/lectures/new")} size="sm">
            <PenLine className="mr-2 h-4 w-4" />
            강의 등록
          </Button>
        </div>
      </div>

      <StatusNavigation value={statusFilter} counts={yearStatusCounts} onChange={setStatusFilter} className="mb-5" />

      {!showMonthlyDashboard && (
        <section className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">필터</span>
          <YearSelect selectedYear={selectedYear} availableYears={availableYears} onChange={setSelectedYear} />
          <MonthSelect selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </section>
      )}

      {lectures.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-4 py-14 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-base font-semibold text-foreground">등록된 강의가 없습니다.</h2>
          <p className="mt-1 text-sm text-muted-foreground">강의를 먼저 등록해 주세요.</p>
          <Button className="mt-4" onClick={() => navigate("/lectures/new")}>
            강의 등록
          </Button>
        </section>
      ) : (
        <>
          {showMonthlyDashboard && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {monthStats.map((stats) => (
                <MonthArchiveCard
                  key={stats.month}
                  stats={stats}
                  selected={selectedMonth === stats.month}
                  onClick={() => setSelectedMonth(stats.month)}
                />
              ))}
            </section>
          )}

          <section className={showMonthlyDashboard ? "mt-6 rounded-xl border border-border bg-card p-4" : "rounded-xl border border-border bg-card p-4"}>
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {selectedYear}년 {selectedMonth}월 강의 목록
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {selectedStatusLabel} 기준으로 {selectedMonthLectures.length}건을 표시합니다.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{getSortDescription(statusFilter)}</p>
            </div>

            {selectedMonthLectures.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
                이 달에는 등록된 강의가 없습니다.
              </div>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {selectedMonthLectures.map((lecture) => (
                  <CompactLectureCard
                    key={lecture.id}
                    lecture={lecture}
                    isPastBefore={isPastBeforeLecture(lecture, todayStr)}
                    onAction={openLectureAction}
                    onSms={setSmsTarget}
                    onPromote={promoteLecture}
                    onRollback={rollbackLecture}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingLectures={lectures}
        onImport={async (items, policy) => {
          const count = await bulkAddLectures(items, policy);
          toast.success(`${count}개의 강의를 가져왔습니다.`);
        }}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteLecture(deleteTarget.id);
          setDeleteTarget(null);
          toast.success("강의를 삭제했습니다.");
        }}
        lectureName={deleteTarget?.title}
      />

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={smsTarget.workflowStage === "after" ? "thankyou" : "reminder"}
          onRecord={async (type, recipient, content) => {
            await recordSmsHistory(smsTarget.id, type, recipient, content);
            toast.success("문자 발송 이력을 기록했습니다.");
          }}
        />
      )}

      <LectureActionDrawer
        lectureId={actionLectureId}
        mode={actionMode}
        open={!!actionLectureId && !!actionMode}
        onOpenChange={closeLectureAction}
      />
    </div>
  );
}

function CompactLectureCard({
  lecture,
  isPastBefore,
  onAction,
  onSms,
  onPromote,
  onRollback,
  onDelete,
}: {
  lecture: Lecture;
  isPastBefore: boolean;
  onAction: (lecture: Lecture, mode: LectureActionMode) => void;
  onSms: (lecture: Lecture) => void;
  onPromote: (lecture: Lecture) => void;
  onRollback: (lecture: Lecture) => void;
  onDelete: (id: string) => void;
}) {
  const { profile, contactLogs } = useSupabase();
  const previousStage = getPreviousWorkflowStage(lecture.workflowStage);
  const afterRecordLabel = getAfterRecordLabel(lecture);
  const subtitle = [formatDateDots(lecture.date), lecture.organization || lecture.target].filter(Boolean).join(" / ");
  const managerText =
    lecture.managerName || lecture.managerPhone
      ? `담당자 ${lecture.managerName || "미정"}${lecture.managerPhone ? ` (${lecture.managerPhone})` : ""}`
      : "담당자 미정";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onAction(lecture, "detail")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onAction(lecture, "detail");
      }}
      className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-semibold leading-5 text-foreground">{lecture.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass[lecture.workflowStage]}`}>
            {statusLabels[lecture.workflowStage]}
          </span>
          {isPastBefore && (
            <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              날짜 지남
            </span>
          )}
        </div>
      </div>

      <p className="mb-1 truncate text-xs text-muted-foreground">{subtitle || "날짜 / 기관 미입력"}</p>

      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span className="min-w-0 max-w-full truncate">{lecture.location || "장소 미입력"}</span>
        <span className="text-muted-foreground/60">·</span>
        <TravelRouteSummary lecture={lecture} compact />
        <span className="text-muted-foreground/60">·</span>
        <NaverRouteButton startAddress={profile?.homeAddress} endAddress={lecture.location} />
      </div>

      <p className="mb-2 truncate text-xs text-muted-foreground">{managerText}</p>

      <LectureContactSummary
        lecture={lecture}
        contactLogs={contactLogs}
        onOpen={() => onAction(lecture, "contact-logs")}
        className="mb-2"
      />

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2" onClick={(event) => event.stopPropagation()}>
        {lecture.workflowStage !== "after" && <CompactAction onClick={() => onAction(lecture, "detail")}>상세보기</CompactAction>}
        {lecture.workflowStage === "before" && <CompactAction onClick={() => onAction(lecture, "tasks")}>업무관리</CompactAction>}
        <CompactAction onClick={() => onAction(lecture, "after-record")} tone="amber">
          {afterRecordLabel}
        </CompactAction>
        {lecture.workflowStage === "after" && (
          <>
            <CompactAction onClick={() => onAction(lecture, "report")}>결과보고서</CompactAction>
            <CompactAction onClick={() => onAction(lecture, "blog")}>홍보 블로그 작성</CompactAction>
            <CompactAction onClick={() => onPromote(lecture)} tone="green">홍보 완료 처리</CompactAction>
          </>
        )}
        {lecture.workflowStage === "promoted" && (
          <>
            <CompactAction onClick={() => onAction(lecture, "report")}>결과보고서</CompactAction>
            <CompactAction onClick={() => onAction(lecture, "blog")}>블로그 보기</CompactAction>
            {previousStage && <CompactAction onClick={() => onRollback(lecture)}>상태 되돌리기</CompactAction>}
          </>
        )}
        {lecture.managerPhone && (
          <>
            <CompactAction onClick={() => onSms(lecture)} tone="green">문자</CompactAction>
            <a
              href={`tel:${lecture.managerPhone}`}
              className="inline-flex h-7 items-center rounded-md border border-blue-200 px-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
            >
              전화
            </a>
          </>
        )}
        <CompactAction onClick={() => onDelete(lecture.id)} tone="red">삭제</CompactAction>
      </div>
    </article>
  );
}

function CompactAction({
  children,
  tone = "default",
  onClick,
}: {
  children: ReactNode;
  tone?: "default" | "amber" | "green" | "red";
  onClick: () => void;
}) {
  const toneClass = {
    default: "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
    green: "border-green-200 text-green-700 hover:bg-green-50",
    red: "border-red-200 text-red-700 hover:bg-red-50",
  }[tone];

  return (
    <button type="button" onClick={onClick} className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </button>
  );
}

function YearSelect({
  selectedYear,
  availableYears,
  onChange,
}: {
  selectedYear: string;
  availableYears: string[];
  onChange: (year: string) => void;
}) {
  return (
    <select
      value={selectedYear}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
    >
      {availableYears.map((year) => (
        <option key={year} value={year}>
          {year}년
        </option>
      ))}
    </select>
  );
}

function MonthSelect({ selectedMonth, onChange }: { selectedMonth: number; onChange: (month: number) => void }) {
  return (
    <select
      value={String(selectedMonth)}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
    >
      {monthNames.map((monthName, index) => (
        <option key={monthName} value={String(index + 1)}>
          {monthName}
        </option>
      ))}
    </select>
  );
}

function MonthArchiveCard({ stats, selected, onClick }: { stats: MonthStats; selected: boolean; onClick: () => void }) {
  const audienceRatio =
    stats.adultParticipants > 0 && stats.youthParticipants > 0
      ? `${stats.adultParticipants}:${stats.youthParticipants}`
      : "분류 미입력";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{monthNames[stats.month - 1]}</h3>
        <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{stats.lectures.length}건</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric icon={<BarChart3 className="h-3.5 w-3.5" />} label="강의횟수" value={`${stats.lectures.length}`} />
        <Metric icon={<Clock className="h-3.5 w-3.5" />} label="강의시간" value={formatHours(stats.totalHours)} />
        <Metric icon={<Users className="h-3.5 w-3.5" />} label="참여인원" value={`${stats.totalParticipants}명`} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
        <StatusPill label="강의 전" value={stats.counts.before} className="bg-blue-50 text-blue-700" />
        <StatusPill label="강의 후" value={stats.counts.after} className="bg-amber-50 text-amber-700" />
        <StatusPill label="홍보 완료" value={stats.counts.promoted} className="bg-green-50 text-green-700" />
      </div>

      <div className="mt-3 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
        <AudienceLine label="성인" value={stats.adultParticipants > 0 ? `${stats.adultParticipants}명` : "분류 미입력"} />
        <AudienceLine label="청소년" value={stats.youthParticipants > 0 ? `${stats.youthParticipants}명` : "분류 미입력"} />
        <AudienceLine
          label="성인:청소년"
          value={`${audienceRatio}${stats.hasEstimatedAudience && audienceRatio !== "분류 미입력" ? " 추정" : ""}`}
        />
      </div>
    </button>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-2">
      <div className="mx-auto mb-1 flex justify-center text-primary">{icon}</div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}

function StatusPill({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={`rounded-md px-1.5 py-1 text-center font-semibold ${className}`}>{label} {value}</div>;
}

function AudienceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex justify-between gap-2 first:mt-0">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function buildMonthStats(month: number, lectures: Lecture[]): MonthStats {
  return lectures.reduce<MonthStats>(
    (stats, lecture) => {
      const participants = getParticipantCount(lecture);
      const audience = classifyAudience(lecture);
      stats.totalHours += getLectureHours(lecture);
      stats.totalParticipants += participants;
      stats.hasEstimatedAudience ||= audience.estimated;

      if (audience.kind === "adult") stats.adultParticipants += participants;
      if (audience.kind === "youth") stats.youthParticipants += participants;
      if (audience.kind === "unknown") stats.unknownParticipants += participants;

      return stats;
    },
    {
      month,
      lectures,
      totalHours: 0,
      totalParticipants: 0,
      adultParticipants: 0,
      youthParticipants: 0,
      unknownParticipants: 0,
      hasEstimatedAudience: false,
      counts: getStatusCounts(lectures),
    }
  );
}

function getLectureHours(lecture: Lecture): number {
  if (lecture.startTime && lecture.endTime) {
    const start = parseTimeToMinutes(lecture.startTime);
    const end = parseTimeToMinutes(lecture.endTime);
    if (start !== null && end !== null && end > start) return (end - start) / 60;
  }

  const durationText = String(lecture.duration ?? "");
  const hourMatch = durationText.match(/(\d+(?:\.\d+)?)\s*(시간|h|hr|hour)/i);
  if (hourMatch) return Number(hourMatch[1]);

  const minuteMatch = durationText.match(/(\d+)\s*(분|m|min)/i);
  if (minuteMatch) return Number(minuteMatch[1]) / 60;

  const numeric = Number(durationText.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getParticipantCount(lecture: Lecture): number {
  return Number(lecture.actualParticipants ?? lecture.participants ?? 0) || 0;
}

function compareBeforeLectures(a: Lecture, b: Lecture, todayStr: string): number {
  const aPast = isPastBeforeLecture(a, todayStr);
  const bPast = isPastBeforeLecture(b, todayStr);

  if (aPast !== bPast) return aPast ? -1 : 1;
  if (aPast && bPast) return b.date.localeCompare(a.date);
  return a.date.localeCompare(b.date);
}

function isPastBeforeLecture(lecture: Lecture, todayStr: string): boolean {
  return lecture.workflowStage === "before" && Boolean(lecture.date) && lecture.date < todayStr;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDots(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${year}.${month}.${day}`;
}

function classifyAudience(lecture: Lecture): { kind: AudienceKind; estimated: boolean } {
  const text = [lecture.target, lecture.topic, lecture.organization, lecture.title].filter(Boolean).join(" ");
  if (!text.trim()) return { kind: "unknown", estimated: false };

  if (/(성인|시니어|노인|어르신|복지관|직장인|공무원|부모|학부모|교직원|기업|기관)/.test(text)) {
    return { kind: "adult", estimated: true };
  }
  if (/(초등|중등|고등|청소년|학생|아동|어린이|학교|중학교|고등학교|초등학교)/.test(text)) {
    return { kind: "youth", estimated: true };
  }
  return { kind: "unknown", estimated: false };
}

function getAfterRecordLabel(lecture: Lecture): string {
  if (lecture.workflowStage === "before") return "강의 후 정리";
  if (lecture.workflowStage === "after") return "강의 후 기록 보완";
  if (hasAfterRecord(lecture)) return "강의 후 기록 보기/수정";
  return "강의 후 기록 보기/수정";
}

function formatHours(hours: number): string {
  if (hours <= 0) return "미입력";
  if (Number.isInteger(hours)) return `${hours}시간`;
  return `${hours.toFixed(1)}시간`;
}

function getSortDescription(statusFilter: LectureStatusFilter): string {
  if (statusFilter === "before") return "강의 전: 날짜 지남 먼저, 이후 가까운 예정일 순";
  if (statusFilter === "after") return "강의 후: 최신 날짜 순";
  if (statusFilter === "promoted") return "홍보 완료: 최신 날짜 순";
  return "전체: 최신 날짜 순";
}
