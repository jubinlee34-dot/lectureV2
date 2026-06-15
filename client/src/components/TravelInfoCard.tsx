import { NaverRouteButton } from "@/components/NaverRouteButton";
import { Button } from "@/components/ui/button";
import { formatDistanceKm, formatDurationMin } from "@/services/naverRouteService";
import { Car, Loader2, Navigation, RefreshCcw } from "lucide-react";

interface TravelInfoCardProps {
  homeAddress?: string;
  destination: string;
  distanceKm?: number;
  durationMin?: number;
  calculating?: boolean;
  onCalculate?: () => void;
}

export function TravelInfoCard({
  homeAddress,
  destination,
  distanceKm,
  durationMin,
  calculating = false,
  onCalculate,
}: TravelInfoCardProps) {
  if (!homeAddress) {
    return (
      <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 dark:border-amber-950/35 dark:bg-amber-950/10">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400">
          <Car className="h-4 w-4" />
          출발 경로 정보
        </h2>
        <p className="text-xs leading-relaxed text-amber-700/95 dark:text-amber-500/90">
          강사 집 주소가 등록되어 있지 않습니다. 프로필에 집 주소를 등록하면 강의 장소까지의 길찾기 링크와 이동 정보를 사용할 수 있습니다.
        </p>
      </section>
    );
  }

  const distanceText = formatDistanceKm(distanceKm);
  const durationText = formatDurationMin(durationMin);
  const hasRouteData = Boolean(distanceText && durationText);

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Car className="h-4 w-4 text-primary" />
        출발 경로 정보
      </h2>

      <div className="space-y-3">
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-1.5">
            <span className="w-14 shrink-0 font-semibold text-foreground/80">출발지:</span>
            <span className="truncate" title={homeAddress}>
              {homeAddress}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="w-14 shrink-0 font-semibold text-foreground/80">도착지:</span>
            <span className="truncate" title={destination}>
              {destination}
            </span>
          </div>

          {hasRouteData ? (
            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-2.5">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] font-medium text-muted-foreground">예상 거리</div>
                <div className="mt-0.5 text-sm font-bold text-foreground">{distanceText}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] font-medium text-muted-foreground">예상 시간</div>
                <div className="mt-0.5 text-sm font-bold text-primary">{durationText}</div>
              </div>
            </div>
          ) : (
            <div className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
              저장된 경로 정보가 없습니다. 필요할 때만 계산하면 결과가 Supabase에 저장되어 다음부터 재사용됩니다.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center">
          <NaverRouteButton
            startAddress={homeAddress}
            endAddress={destination}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-green-500/20 bg-green-500/10 px-3 text-center text-xs font-semibold text-green-700 transition-all hover:bg-green-500/20 dark:text-green-400"
            label="네이버 지도 열기"
            icon={<Navigation className="mr-1.5 h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
          />
          {onCalculate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={onCalculate}
              disabled={calculating || !destination}
            >
              {calculating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {hasRouteData ? "경로 다시 계산" : "경로 계산"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
