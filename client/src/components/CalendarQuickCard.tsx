import { NaverRouteButton } from "@/components/NaverRouteButton";
import { TravelRouteSummary } from "@/components/TravelRouteSummary";
import { Badge } from "@/components/ui/badge";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useStarredTasks } from "@/hooks/useStarredTasks";
import type { LectureActionMode } from "@/components/LectureActionDrawer";
import type { Lecture } from "@/types/lecture";
import { hasAfterRecord } from "@/utils/afterRecord";
import { getPreviousWorkflowStage, statusBadgeClass, statusLabels } from "@/utils/lectureStatus";
import { Building2, Car, ClipboardCheck, FileText, MapPin, MessageCircle, Phone, RotateCcw, Star, Trash2 } from "lucide-react";
import type React from "react";

interface CalendarQuickCardProps {
  lecture: Lecture;
  onAction: (lecture: Lecture, mode: LectureActionMode) => void;
  onSelect?: (lecture: Lecture) => void;
  onSms?: (lecture: Lecture) => void;
  onPromote?: (lecture: Lecture) => void;
  onRollback?: (lecture: Lecture) => void;
  onDelete?: (id: string) => void;
  onAfterRecord?: (lecture: Lecture) => void;
}

export function CalendarQuickCard({
  lecture,
  onAction,
  onSelect,
  onSms,
  onPromote,
  onRollback,
  onDelete,
  onAfterRecord,
}: CalendarQuickCardProps) {
  const { profile } = useSupabase();
  const { starredBeforeTasks, starredAfterTasks } = useStarredTasks(lecture.id);
  const previousStage = getPreviousWorkflowStage(lecture.workflowStage);
  const afterRecordLabel = getCardAfterRecordLabel(lecture);

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, [data-card-action='true']")) return;
    onSelect?.(lecture);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSelect(lecture);
  };

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`rounded-lg border border-border p-3 ${onSelect ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/20" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-tight text-foreground">{lecture.title}</p>
        <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold ${statusBadgeClass[lecture.workflowStage]}`}>
          {statusLabels[lecture.workflowStage]}
        </Badge>
      </div>

      <div className="mb-2 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {lecture.organization}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {lecture.location}
        </p>
        <div className="pl-5">
          <TravelRouteSummary lecture={lecture} compact />
        </div>
        <div className="pl-5 pt-0.5">
          <NaverRouteButton
            startAddress={profile?.homeAddress}
            endAddress={lecture.location}
            className="flex items-center gap-1.5 font-semibold text-green-700 hover:underline dark:text-green-400"
            label="네이버 길찾기"
            icon={<Car className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {(lecture.managerName || lecture.managerPhone) && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/75">담당자 </span>
          <span>{lecture.managerName || "미등록"}</span>
          {lecture.managerPhone && <span className="text-[10px] opacity-75"> ({lecture.managerPhone})</span>}
        </div>
      )}

      {(starredBeforeTasks.length > 0 || starredAfterTasks.length > 0) && (
        <div className="mb-2 space-y-1 rounded-md border border-border/50 bg-muted/50 p-2 text-[10px]">
          {starredBeforeTasks.length > 0 && <TaskSummary label="강의 전 필수" texts={starredBeforeTasks.map((task) => task.text)} />}
          {starredAfterTasks.length > 0 && <TaskSummary label="강의 후 필수" texts={starredAfterTasks.map((task) => task.text)} />}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <QuickAction onClick={() => onAction(lecture, "detail")}>상세보기</QuickAction>
        {lecture.workflowStage === "before" && (
          <>
            <QuickAction onClick={() => onAction(lecture, "tasks")} icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
              업무관리
            </QuickAction>
            {onAfterRecord && (
              <QuickAction onClick={() => onAction(lecture, "after-record")} tone="amber" icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
                {afterRecordLabel}
              </QuickAction>
            )}
          </>
        )}
        {lecture.workflowStage === "after" && (
          <>
            <QuickAction onClick={() => onAction(lecture, "tasks")} icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
              업무관리
            </QuickAction>
            {onAfterRecord && (
              <QuickAction onClick={() => onAction(lecture, "after-record")} tone="amber" icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
                {afterRecordLabel}
              </QuickAction>
            )}
            <QuickAction onClick={() => onAction(lecture, "report")} icon={<FileText className="h-3.5 w-3.5" />}>
              결과보고서
            </QuickAction>
            <QuickAction onClick={() => onAction(lecture, "blog")}>홍보 블로그 작성</QuickAction>
            {onPromote && (
              <QuickAction onClick={() => onPromote(lecture)} tone="green">
                홍보 완료 처리
              </QuickAction>
            )}
          </>
        )}
        {lecture.workflowStage === "promoted" && (
          <>
            {onAfterRecord && (
              <QuickAction onClick={() => onAction(lecture, "after-record")} tone="amber" icon={<ClipboardCheck className="h-3.5 w-3.5" />}>
                {afterRecordLabel}
              </QuickAction>
            )}
            <QuickAction onClick={() => onAction(lecture, "report")} icon={<FileText className="h-3.5 w-3.5" />}>
              결과보고서
            </QuickAction>
            <QuickAction onClick={() => onAction(lecture, "blog")}>블로그 보기</QuickAction>
            {previousStage && onRollback && (
              <QuickAction onClick={() => onRollback(lecture)} icon={<RotateCcw className="h-3.5 w-3.5" />}>
                상태 되돌리기
              </QuickAction>
            )}
          </>
        )}
        {lecture.managerPhone && (
          <>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSms?.(lecture);
              }}
              className="inline-flex h-7 items-center justify-center rounded-md border border-green-200 px-2 text-xs text-green-700 hover:bg-green-50"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              문자
            </button>
            <a
              href={`tel:${lecture.managerPhone}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-7 items-center justify-center rounded-md border border-blue-200 px-2 text-xs text-blue-700 hover:bg-blue-50"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          </>
        )}
        {lecture.workflowStage !== "promoted" && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(lecture.id);
            }}
            className="ml-auto inline-flex h-7 items-center justify-center rounded-md border border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            삭제
          </button>
        )}
      </div>
    </div>
  );
}

function getCardAfterRecordLabel(lecture: Lecture): string {
  if (lecture.workflowStage === "before") return "강의 후 정리";
  if (hasAfterRecord(lecture)) return "강의 후 기록 보기/수정";
  return lecture.workflowStage === "after" ? "강의 후 기록 보완" : "강의 후 기록 보기/수정";
}

function QuickAction({
  children,
  icon,
  tone = "default",
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "amber" | "green";
  onClick: () => void;
}) {
  const toneClass = {
    default: "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
    green: "border-green-200 text-green-700 hover:bg-green-50",
  }[tone];

  return (
    <button
      data-card-action="true"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-xs ${toneClass}`}
    >
      {icon}
      {children}
    </button>
  );
}

function TaskSummary({ label, texts }: { label: string; texts: string[] }) {
  return (
    <div className="flex items-start gap-1">
      <Star className="mt-0.5 h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
      <span className="shrink-0 font-bold text-amber-800 dark:text-amber-400">[{label}]:</span>
      <span className="leading-relaxed text-foreground/80">{texts.join(", ")}</span>
    </div>
  );
}
