import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarQuickCard } from "@/components/CalendarQuickCard";
import { ImportModal } from "@/components/ImportModal";
import {
  LectureActionDrawer,
  type LectureActionMode,
} from "@/components/LectureActionDrawer";
import { MonthLectureList } from "@/components/MonthLectureList";
import { SmsModal } from "@/components/SmsModal";
import { StatusNavigation } from "@/components/StatusNavigation";
import { Button } from "@/components/ui/button";
import { useLectures } from "@/hooks/useLectures";
import type { Lecture } from "@/types/lecture";
import { downloadCSV, downloadICS } from "@/utils/exportUtils";
import {
  getPreviousWorkflowStage,
  getStatusCounts,
  type LectureStatusFilter,
  statusLabels,
} from "@/utils/lectureStatus";
import { recordSmsHistory } from "@/utils/storage";
import { CalendarDays, Download, Plus, Sheet, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { lectures, bulkAddLectures, updateLecture, deleteLecture } =
    useLectures();
  const today = new Date();
  const initialCalendarState = readCalendarQueryState(today);
  const [viewYear, setViewYear] = useState(initialCalendarState.year);
  const [viewMonth, setViewMonth] = useState(initialCalendarState.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialCalendarState.date
  );
  const [smsTarget, setSmsTarget] = useState<Lecture | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LectureStatusFilter>(
    initialCalendarState.status
  );
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(
    initialCalendarState.selectedLectureId
  );
  const [actionLectureId, setActionLectureId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<LectureActionMode | null>(null);

  const statusCounts = useMemo(() => getStatusCounts(lectures), [lectures]);
  const statusFilteredLectures = useMemo(
    () =>
      statusFilter === "all"
        ? lectures
        : lectures.filter(lecture => lecture.workflowStage === statusFilter),
    [lectures, statusFilter]
  );

  const lectureMap = useMemo(() => {
    return statusFilteredLectures.reduce<Record<string, Lecture[]>>(
      (map, lecture) => {
        map[lecture.date] = [...(map[lecture.date] ?? []), lecture];
        return map;
      },
      {}
    );
  }, [statusFilteredLectures]);

  const selectedLecture = selectedLectureId
    ? lectures.find(lecture => lecture.id === selectedLectureId)
    : undefined;

  const monthLectures = useMemo(() => {
    return statusFilteredLectures
      .filter(lecture => {
        const date = new Date(lecture.date);
        return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [statusFilteredLectures, viewYear, viewMonth]);

  const moveMonth = (diff: number) => {
    const next = new Date(viewYear, viewMonth + diff, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectCalendarDate = (date: string | null) => {
    setSelectedDate(date);
    if (!date) {
      setSelectedLectureId(null);
      return;
    }

    const firstLecture = [...(lectureMap[date] ?? [])].sort((a, b) => {
      const timeOrder = (a.startTime ?? "").localeCompare(b.startTime ?? "");
      if (timeOrder !== 0) return timeOrder;
      return a.title.localeCompare(b.title);
    })[0];

    setSelectedLectureId(firstLecture?.id ?? null);
  };

  const calendarReturnTo = useMemo(
    () =>
      buildCalendarReturnTo({
        date: selectedDate,
        status: statusFilter,
        year: viewYear,
        month: viewMonth,
      }),
    [selectedDate, statusFilter, viewYear, viewMonth]
  );

  useEffect(() => {
    window.history.replaceState(null, "", calendarReturnTo);
  }, [calendarReturnTo]);

  useEffect(() => {
    if (!selectedLectureId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedLectureId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLectureId]);

  useEffect(() => {
    if (selectedLectureId && !selectedLecture) setSelectedLectureId(null);
  }, [selectedLectureId, selectedLecture]);

  useEffect(() => {
    if (!selectedLecture) return;
    setSelectedDate(selectedLecture.date);
    const date = new Date(selectedLecture.date);
    if (!Number.isNaN(date.getTime())) {
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
  }, [selectedLecture]);

  const promoteLecture = async (lecture: Lecture) => {
    if (!lecture.blogUrl?.trim()) {
      const confirmed = window.confirm(
        "블로그 URL이 비어 있습니다. 그래도 홍보 완료로 처리할까요?"
      );
      if (!confirmed) return;
    }
    await updateLecture(lecture.id, {
      workflowStage: "promoted",
      blogWritten: lecture.blogWritten || Boolean(lecture.blogUrl?.trim()),
    });
    toast.success("홍보 완료 상태로 변경했습니다.");
  };

  const rollbackLecture = async (lecture: Lecture) => {
    const previousStage = getPreviousWorkflowStage(lecture.workflowStage);
    if (!previousStage) return;
    const confirmed = window.confirm(
      `${statusLabels[lecture.workflowStage]} 상태를 ${statusLabels[previousStage]} 상태로 되돌릴까요?`
    );
    if (!confirmed) return;
    await updateLecture(lecture.id, { workflowStage: previousStage });
    toast.success(`${statusLabels[previousStage]} 상태로 되돌렸습니다.`);
  };

  const openLectureAction = (lecture: Lecture, mode: LectureActionMode) => {
    setActionLectureId(lecture.id);
    setActionMode(mode);
  };

  const closeLectureAction = (open: boolean) => {
    if (open) return;
    setActionLectureId(null);
    setActionMode(null);
  };

  const handleDeleteLecture = (lectureId: string) => {
    deleteLecture(lectureId);
    if (selectedLectureId === lectureId) setSelectedLectureId(null);
    toast.success("강의 일정을 삭제했습니다.");
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" />
            강의 캘린더
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            월별 목록에서 강의를 선택하고, 캘린더에서는 날짜별 일정을
            탐색합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="hidden lg:inline-flex"
          >
            <Upload className="mr-1.5 h-4 w-4 text-blue-600" />
            가져오기
          </Button>
          {lectures.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCSV(lectures, "강의목록.csv");
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
                  downloadICS(lectures, "강의일정.ics");
                  toast.success("ICS 파일을 다운로드했습니다.");
                }}
                className="hidden lg:inline-flex"
              >
                <Download className="mr-1.5 h-4 w-4 text-blue-600" />
                ICS
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={() =>
              navigate(
                selectedDate
                  ? `/lectures/new?date=${selectedDate}`
                  : "/lectures/new"
              )
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            강의 등록
          </Button>
        </div>
      </div>

      <StatusNavigation
        value={statusFilter}
        counts={statusCounts}
        onChange={setStatusFilter}
        className="mb-4"
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(520px,1fr)_340px] xl:grid-cols-[280px_minmax(520px,1fr)_340px]">
        <aside className="order-3 lg:col-span-2 xl:order-1 xl:col-span-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:pr-1">
          <MonthLectureList
            viewMonth={viewMonth}
            monthLectures={monthLectures}
            selectedLectureId={selectedLectureId}
            selectedDate={selectedDate}
            onSelect={lecture => setSelectedLectureId(lecture.id)}
          />
        </aside>

        <section className="order-1 xl:order-2">
          <CalendarGrid
            viewYear={viewYear}
            viewMonth={viewMonth}
            lectureMap={lectureMap}
            selectedDate={selectedDate}
            onSelectDate={selectCalendarDate}
            onMoveMonth={moveMonth}
          />
        </section>

        <aside className="order-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto xl:order-3">
          {selectedLecture ? (
            <CalendarLectureDetailPanel
              lecture={selectedLecture}
              onClose={() => setSelectedLectureId(null)}
              onAction={openLectureAction}
              onSms={setSmsTarget}
              onPromote={promoteLecture}
              onRollback={rollbackLecture}
              onDelete={handleDeleteLecture}
            />
          ) : (
            <CalendarLectureEmptyPanel />
          )}
        </aside>
      </div>

      {smsTarget && (
        <SmsModal
          open={!!smsTarget}
          onClose={() => setSmsTarget(null)}
          lecture={smsTarget}
          defaultType={
            smsTarget.workflowStage === "after" ? "thankyou" : "reminder"
          }
          onRecord={(type, recipient, content) => {
            recordSmsHistory(smsTarget.id, type, recipient, content);
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

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultType="ics"
        existingLectures={lectures}
        onImport={async (items, policy) => {
          const count = await bulkAddLectures(items, policy);
          toast.success(`${count}개의 강의를 가져왔습니다.`);
        }}
      />
    </div>
  );
}

function CalendarLectureDetailPanel({
  lecture,
  onClose,
  onAction,
  onSms,
  onPromote,
  onRollback,
  onDelete,
}: {
  lecture: Lecture;
  onClose: () => void;
  onAction: (lecture: Lecture, mode: LectureActionMode) => void;
  onSms: (lecture: Lecture) => void;
  onPromote: (lecture: Lecture) => void;
  onRollback: (lecture: Lecture) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section
      onClick={onClose}
      className="rounded-xl border border-primary/30 bg-primary/5 p-2"
    >
      <div
        onClick={event => event.stopPropagation()}
        className="rounded-lg bg-card p-3 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">선택 강의</p>
            <h3 className="truncate text-sm font-semibold text-foreground">
              {lecture.title}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CalendarQuickCard
          lecture={lecture}
          onAction={onAction}
          onSms={onSms}
          onAfterRecord={() => undefined}
          onPromote={onPromote}
          onRollback={onRollback}
          onDelete={onDelete}
        />
      </div>
    </section>
  );
}

function CalendarLectureEmptyPanel() {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <h3 className="text-sm font-semibold text-foreground">
        강의를 선택해 주세요.
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        왼쪽 월별 강의 리스트에서 강의를 클릭하면 이곳에 상세 정보와 업무 액션이
        표시됩니다.
      </p>
    </section>
  );
}

function readCalendarQueryState(today: Date): {
  date: string | null;
  status: LectureStatusFilter;
  year: number;
  month: number;
  selectedLectureId: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  const date = params.get("date");
  const statusParam = params.get("status");
  const status: LectureStatusFilter =
    statusParam === "before" ||
    statusParam === "after" ||
    statusParam === "promoted" ||
    statusParam === "all"
      ? statusParam
      : "all";
  const yearFromDate = date?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? Number(date.slice(0, 4))
    : null;
  const monthFromDate = date?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? Number(date.slice(5, 7)) - 1
    : null;
  const yearParam = Number(params.get("year"));
  const monthParam = Number(params.get("month"));
  const year =
    Number.isFinite(yearParam) && yearParam > 1900
      ? yearParam
      : (yearFromDate ?? today.getFullYear());
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam - 1
      : (monthFromDate ?? today.getMonth());

  return {
    date: date?.match(/^\d{4}-\d{2}-\d{2}$/) ? date : null,
    status,
    year,
    month,
    selectedLectureId: params.get("selectedLectureId"),
  };
}

function buildCalendarReturnTo({
  date,
  status,
  year,
  month,
}: {
  date: string | null;
  status: LectureStatusFilter;
  year: number;
  month: number;
}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("status", status);
  params.set("year", String(year));
  params.set("month", String(month + 1));
  return `/calendar?${params.toString()}`;
}
