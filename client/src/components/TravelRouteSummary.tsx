import { Button } from "@/components/ui/button";
import { useSupabase } from "@/contexts/SupabaseContext";
import { formatDistanceKm, formatDurationMin } from "@/services/naverRouteService";
import type { Lecture } from "@/types/lecture";
import { Loader2, RefreshCcw } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { toast } from "sonner";

interface TravelRouteSummaryProps {
  lecture: Lecture;
  compact?: boolean;
}

export function TravelRouteSummary({ lecture, compact = false }: TravelRouteSummaryProps) {
  const { calculateLectureRoute, profile } = useSupabase();
  const [calculating, setCalculating] = useState(false);
  const distanceText = formatDistanceKm(lecture.travelDistanceKm);
  const durationText = formatDurationMin(lecture.travelDurationMin);
  const hasRouteData = Boolean(distanceText && durationText);
  const needsRecalculation = hasRouteData && !lecture.travelUpdatedAt;
  const canCalculate = Boolean(profile?.homeAddress?.trim() && lecture.location?.trim());

  const handleCalculate = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canCalculate) {
      toast.error("강사 집 주소와 강의 장소를 먼저 입력해 주세요.");
      return;
    }

    try {
      setCalculating(true);
      await calculateLectureRoute(lecture.id);
      toast.success("거리와 이동시간을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거리 계산에 실패했습니다.");
    } finally {
      setCalculating(false);
    }
  };

  if (hasRouteData) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>
          {distanceText} · {durationText}
        </span>
        {needsRecalculation && (
          <>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              재계산 필요
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleCalculate}
              disabled={calculating || !canCalculate}
            >
              {calculating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-1 h-3 w-3" />}
              재계산
            </Button>
          </>
        )}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={compact ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]"}
      onClick={handleCalculate}
      disabled={calculating || !canCalculate}
    >
      {calculating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-1 h-3 w-3" />}
      거리계산
    </Button>
  );
}
