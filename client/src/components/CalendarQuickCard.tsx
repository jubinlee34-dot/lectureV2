import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Car,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Lecture, WorkflowStage } from "../types/lecture";
import { useSupabase } from "../contexts/SupabaseContext";
import { NaverRouteButton } from "@/components/NaverRouteButton";
import { useStarredTasks } from "../hooks/useStarredTasks";

const stageLabels: Record<WorkflowStage, string> = {
  before: "강의 전",
  after: "강의 후",
  promoted: "홍보 완료",
};

interface CalendarQuickCardProps {
  lecture: Lecture;
  onNavigate: (path: string) => void;
  onSms?: (lecture: Lecture) => void;
  onUpdateStage?: (id: string, data: Partial<Lecture>) => Promise<void> | void;
  onDelete?: (id: string) => void;
}

export function CalendarQuickCard({
  lecture,
  onNavigate,
  onSms,
  onUpdateStage,
  onDelete,
}: CalendarQuickCardProps) {
  const nextStageMap: Record<WorkflowStage, WorkflowStage> = {
    before: "after",
    after: "promoted",
    promoted: "before",
  };

  const { profile } = useSupabase();
  const homeAddress = profile?.homeAddress || "";
  const { starredBeforeTasks, starredAfterTasks } = useStarredTasks(lecture.id);

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStage) {
      const nextStage = nextStageMap[lecture.workflowStage];
      onUpdateStage(lecture.id, { workflowStage: nextStage });
      toast.success(`"${lecture.title}" 단계가 ${stageLabels[nextStage]}로 변경되었습니다.`);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button onClick={() => onNavigate(`/lectures/${lecture.id}`)} className="min-w-0 text-left">
          <p className="text-sm font-semibold leading-tight text-foreground hover:text-primary transition-colors">
            {lecture.title}
          </p>
        </button>
        {onUpdateStage ? (
          <button
            onClick={handleStageClick}
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all hover:opacity-85 cursor-pointer bg-muted hover:bg-muted/80 text-foreground"
          >
            {stageLabels[lecture.workflowStage]}
          </button>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {stageLabels[lecture.workflowStage]}
          </Badge>
        )}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground mb-2">
        <p className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {lecture.organization}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {lecture.location}
        </p>
        {lecture.travel_distance_km && lecture.travel_duration_min && (
          <p className="text-[10px] text-muted-foreground/80 pl-5">
            예상 거리: {lecture.travel_distance_km} · 예상 시간: {lecture.travel_duration_min}
          </p>
        )}
        <div className="pl-5 pt-0.5">
          <NaverRouteButton
            startAddress={homeAddress}
            endAddress={lecture.location}
            className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold hover:underline cursor-pointer"
            label="네이버 길찾기"
            icon={<Car className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* 담당자 정보 */}
      {(lecture.managerName || lecture.managerPhone) && (
        <div className="mb-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/75">담당자: </span>
          <span>{lecture.managerName || "미등록"}</span>
          {lecture.managerPhone && <span className="text-[10px] opacity-75"> ({lecture.managerPhone})</span>}
        </div>
      )}

      {/* 필수 준비사항 */}
      {(starredBeforeTasks.length > 0 || starredAfterTasks.length > 0) && (
        <div className="mb-2 rounded-md bg-muted/50 p-2 border border-border/50 text-[10px] space-y-1">
          {starredBeforeTasks.length > 0 && (
            <div className="flex items-start gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
              <span className="font-bold text-amber-800 dark:text-amber-400 shrink-0">[강의전 필수]:</span>
              <span className="text-foreground/80 leading-relaxed">
                {starredBeforeTasks.map((t) => t.text).join(", ")}
              </span>
            </div>
          )}
          {starredAfterTasks.length > 0 && (
            <div className="flex items-start gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
              <span className="font-bold text-amber-800 dark:text-amber-400 shrink-0">[강의후 필수]:</span>
              <span className="text-foreground/80 leading-relaxed">
                {starredAfterTasks.map((t) => t.text).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2 items-center">
        {lecture.managerPhone && (
          <>
            <button
              onClick={() => onSms?.(lecture)}
              className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-green-200 text-xs text-green-700 hover:bg-green-50 cursor-pointer"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              문자
            </button>
            <a
              href={`tel:${lecture.managerPhone}`}
              className="inline-flex h-7 items-center justify-center rounded-md border border-blue-200 px-2 text-xs text-blue-700 hover:bg-blue-50"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          </>
        )}
        <button
          onClick={() => onDelete?.(lecture.id)}
          className="inline-flex h-7 px-2.5 items-center justify-center rounded-md border border-red-200 text-xs text-red-700 hover:bg-red-50 cursor-pointer ml-auto"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          삭제
        </button>
      </div>
    </div>
  );
}
