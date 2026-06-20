import { NaverRouteButton } from "@/components/NaverRouteButton";
import { TravelRouteSummary } from "@/components/TravelRouteSummary";
import { Badge } from "@/components/ui/badge";
import { useSupabase } from "@/contexts/SupabaseContext";
import { useStarredTasks } from "@/hooks/useStarredTasks";
import type { Lecture, WorkflowStage } from "@/types/lecture";
import { Building2, Car, MapPin, MessageCircle, Phone, Star, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { toast } from "sonner";

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
  const { profile } = useSupabase();
  const { starredBeforeTasks, starredAfterTasks } = useStarredTasks(lecture.id);

  const handleStageClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (!onUpdateStage) return;

    const nextStageMap: Record<WorkflowStage, WorkflowStage> = {
      before: "after",
      after: "promoted",
      promoted: "before",
    };
    const nextStage = nextStageMap[lecture.workflowStage];
    onUpdateStage(lecture.id, { workflowStage: nextStage });
    toast.success(`"${lecture.title}" 단계가 ${stageLabels[nextStage]}로 변경되었습니다.`);
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button onClick={() => onNavigate(`/lectures/${lecture.id}`)} className="min-w-0 text-left">
          <p className="text-sm font-semibold leading-tight text-foreground transition-colors hover:text-primary">
            {lecture.title}
          </p>
        </button>
        {onUpdateStage ? (
          <button
            onClick={handleStageClick}
            className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground transition-all hover:bg-muted/80"
          >
            {stageLabels[lecture.workflowStage]}
          </button>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {stageLabels[lecture.workflowStage]}
          </Badge>
        )}
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
          {starredBeforeTasks.length > 0 && (
            <TaskSummary label="강의 전 필수" texts={starredBeforeTasks.map((task) => task.text)} />
          )}
          {starredAfterTasks.length > 0 && (
            <TaskSummary label="강의 후 필수" texts={starredAfterTasks.map((task) => task.text)} />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {lecture.managerPhone && (
          <>
            <button
              onClick={() => onSms?.(lecture)}
              className="inline-flex h-7 flex-1 items-center justify-center rounded-md border border-green-200 text-xs text-green-700 hover:bg-green-50"
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
          className="ml-auto inline-flex h-7 items-center justify-center rounded-md border border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          삭제
        </button>
      </div>
    </div>
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
