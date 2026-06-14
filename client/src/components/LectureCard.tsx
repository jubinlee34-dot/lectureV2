import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ClipboardCheck,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  Users,
} from "lucide-react";
import type { Lecture, WorkflowStage } from "../types/lecture";
import { formatDateShort, truncate } from "../utils/format";

interface LectureCardProps {
  lecture: Lecture;
  onClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onManage?: (id: string) => void;
  onSms?: (lecture: Lecture) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onUpdateStage?: (id: string, data: Partial<Lecture>) => void;
}

const stageBadge: Record<WorkflowStage, { label: string; className: string }> = {
  before: { label: "강의 전", className: "bg-blue-100 text-blue-700 border-blue-200" },
  after: { label: "강의 후", className: "bg-amber-100 text-amber-700 border-amber-200" },
  promoted: { label: "홍보 완료", className: "bg-green-100 text-green-700 border-green-200" },
};

export function LectureCard({
  lecture,
  onClick,
  onEdit,
  onDelete,
  onManage,
  onSms,
  selected = false,
  onSelect,
  onUpdateStage,
}: LectureCardProps) {
  const stage = stageBadge[lecture.workflowStage] ?? stageBadge.before;

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStage) {
      const nextStageMap: Record<WorkflowStage, WorkflowStage> = {
        before: "after",
        after: "promoted",
        promoted: "before",
      };
      onUpdateStage(lecture.id, { workflowStage: nextStageMap[lecture.workflowStage] });
    }
  };

  const handleSms = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onSms) {
      onSms(lecture);
      return;
    }
    const body = encodeURIComponent(
      `안녕하세요. ${lecture.managerName || "담당자"}님, ${lecture.organization} <${lecture.title}> 강의 관련해 연락드립니다.\n일시: ${formatDateShort(lecture.date)}\n장소: ${lecture.location}\n확인 부탁드립니다.`
    );
    window.location.href = `sms:${lecture.managerPhone}?body=${body}`;
  };


  return (
    <div
      className={`group relative flex gap-3 cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/40 hover:shadow-sm ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
      }`}
      onClick={() => onClick(lecture.id)}
    >
      {onSelect && (
        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(lecture.id, e.target.checked)}
            className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
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
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
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
          {onUpdateStage ? (
            <button
              onClick={handleStageClick}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-all hover:opacity-85 cursor-pointer ${stage.className}`}
            >
              {stage.label}
            </button>
          ) : (
            <Badge variant="outline" className={`text-[10px] font-medium ${stage.className}`}>
              {stage.label}
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
        </div>

        <div className="flex items-center gap-1.5 border-t border-border pt-2.5" onClick={(e) => e.stopPropagation()}>
          {onManage && (
            <button
              onClick={() => onManage(lecture.id)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ClipboardCheck className="h-3 w-3" />
              업무 관리
            </button>
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
          {lecture.managerName && (
            <span className="ml-auto truncate text-[10px] text-muted-foreground">{lecture.managerName}</span>
          )}
        </div>
      </div>
    </div>
  );
}
