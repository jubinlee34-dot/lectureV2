import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NaverRouteButton } from "@/components/NaverRouteButton";
import { TravelRouteSummary } from "@/components/TravelRouteSummary";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useStarredTasks } from "@/hooks/useStarredTasks";
import type { Lecture } from "@/types/lecture";
import { getPreviousWorkflowStage, statusBadgeClass, statusLabels } from "@/utils/lectureStatus";
import { formatDateShort, truncate } from "@/utils/format";
import {
  Calendar,
  ClipboardCheck,
  FileText,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import type React from "react";

interface LectureCardProps {
  lecture: Lecture;
  onClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onManage?: (id: string) => void;
  onSms?: (lecture: Lecture) => void;
  onAfterRecord?: (lecture: Lecture) => void;
  onReport?: (id: string) => void;
  onBlog?: (id: string) => void;
  onPromote?: (lecture: Lecture) => void;
  onRollback?: (lecture: Lecture) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

export function LectureCard({
  lecture,
  onClick,
  onEdit,
  onDelete,
  onManage,
  onSms,
  onAfterRecord,
  onReport,
  onBlog,
  onPromote,
  onRollback,
  selected = false,
  onSelect,
}: LectureCardProps) {
  const { profile } = useSupabase();
  const { starredBeforeTasks, starredAfterTasks } = useStarredTasks(lecture.id);
  const previousStage = getPreviousWorkflowStage(lecture.workflowStage);

  const handleSms = () => {
    if (onSms) {
      onSms(lecture);
      return;
    }

    const body = encodeURIComponent(
      `안녕하세요. ${lecture.organization} <${lecture.title}> 강의 관련해 연락드립니다.\n일시: ${formatDateShort(lecture.date)}\n장소: ${lecture.location}`
    );
    window.location.href = `sms:${lecture.managerPhone}?body=${body}`;
  };

  return (
    <div
      className={`group relative flex gap-3 rounded-lg border p-4 transition-all hover:border-primary/40 hover:shadow-sm ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
      }`}
      onClick={() => onClick(lecture.id)}
    >
      {onSelect && (
        <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(lecture.id, event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="mb-0.5 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {truncate(lecture.title, 40)}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">{lecture.organization}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(lecture.id)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(lecture.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs font-normal">
            {truncate(lecture.topic, 24)}
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-semibold ${statusBadgeClass[lecture.workflowStage]}`}>
            {statusLabels[lecture.workflowStage]}
          </Badge>
          {lecture.workflowStage === "promoted" && (
            <Badge variant="outline" className="border-green-200 bg-green-50 text-[10px] font-semibold text-green-700">
              완료 상태
            </Badge>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateShort(lecture.date)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {lecture.participants}명
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {truncate(lecture.location, 16)}
          </span>
          <span onClick={(event) => event.stopPropagation()}>
            <TravelRouteSummary lecture={lecture} compact />
          </span>
          <NaverRouteButton startAddress={profile?.homeAddress} endAddress={lecture.location} />
        </div>

        {(lecture.managerName || lecture.managerPhone) && (
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/90">
            <span className="font-semibold text-foreground/75">담당자</span>
            <span>{lecture.managerName || "미등록"}</span>
            {lecture.managerPhone && <span className="text-[10px] opacity-75">({lecture.managerPhone})</span>}
          </div>
        )}

        {(starredBeforeTasks.length > 0 || starredAfterTasks.length > 0) && (
          <div
            className="mb-3 space-y-1.5 rounded-lg border border-border/50 bg-muted/50 p-2.5 text-[11px]"
            onClick={(event) => event.stopPropagation()}
          >
            {starredBeforeTasks.length > 0 && <TaskSummary label="강의 전 필수" texts={starredBeforeTasks.map((task) => task.text)} />}
            {starredAfterTasks.length > 0 && <TaskSummary label="강의 후 필수" texts={starredAfterTasks.map((task) => task.text)} />}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5" onClick={(event) => event.stopPropagation()}>
          <CardAction onClick={() => onClick(lecture.id)}>상세보기</CardAction>
          {lecture.workflowStage === "before" && (
            <>
              {onManage && (
                <CardAction onClick={() => onManage(lecture.id)} icon={<ClipboardCheck className="h-3 w-3" />}>
                  업무관리
                </CardAction>
              )}
              {onAfterRecord && (
                <CardAction onClick={() => onAfterRecord(lecture)} tone="amber" icon={<ClipboardCheck className="h-3 w-3" />}>
                  강의 후 기록 추가
                </CardAction>
              )}
            </>
          )}
          {lecture.workflowStage === "after" && (
            <>
              {onReport && (
                <CardAction onClick={() => onReport(lecture.id)} icon={<FileText className="h-3 w-3" />}>
                  결과보고서
                </CardAction>
              )}
              {onBlog && <CardAction onClick={() => onBlog(lecture.id)}>홍보 블로그 작성</CardAction>}
              {onPromote && (
                <CardAction onClick={() => onPromote(lecture)} tone="green">
                  홍보 완료 처리
                </CardAction>
              )}
            </>
          )}
          {lecture.workflowStage === "promoted" && (
            <>
              {onBlog && <CardAction onClick={() => onBlog(lecture.id)}>블로그 보기</CardAction>}
              {previousStage && onRollback && (
                <CardAction onClick={() => onRollback(lecture)} icon={<RotateCcw className="h-3 w-3" />}>
                  상태 되돌리기
                </CardAction>
              )}
            </>
          )}
          {lecture.managerPhone && (
            <>
              <button
                onClick={handleSms}
                className="flex items-center gap-1 rounded-md bg-green-500 px-2 py-1 text-[11px] text-white transition-colors hover:bg-green-600"
              >
                <MessageCircle className="h-3 w-3" />
                문자
              </button>
              <a
                href={`tel:${lecture.managerPhone}`}
                className="flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-[11px] text-white transition-colors hover:bg-blue-600"
              >
                <Phone className="h-3 w-3" />
                전화
              </a>
            </>
          )}
          {lecture.managerName && <span className="ml-auto truncate text-[10px] text-muted-foreground">{lecture.managerName}</span>}
        </div>
      </div>
    </div>
  );
}

function CardAction({
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
    <button onClick={onClick} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${toneClass}`}>
      {icon}
      {children}
    </button>
  );
}

function TaskSummary({ label, texts }: { label: string; texts: string[] }) {
  return (
    <div className="flex items-start gap-1">
      <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
      <span className="shrink-0 font-bold text-amber-800 dark:text-amber-400">[{label}]:</span>
      <span className="leading-relaxed text-foreground/80">{texts.join(", ")}</span>
    </div>
  );
}
