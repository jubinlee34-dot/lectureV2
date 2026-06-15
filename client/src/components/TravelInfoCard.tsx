import React from "react";
import { Car, Navigation } from "lucide-react";
import { NaverRouteButton } from "./NaverRouteButton";

interface TravelInfoCardProps {
  homeAddress?: string;
  destination: string;
  distanceKm?: string;
  durationMin?: string;
}

export function TravelInfoCard({
  homeAddress,
  destination,
  distanceKm,
  durationMin,
}: TravelInfoCardProps) {
  if (!homeAddress) {
    return (
      <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 dark:border-amber-950/35 dark:bg-amber-950/10">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-400">
          <Car className="h-4 w-4" />
          출강 경로 정보
        </h2>
        <p className="text-xs text-amber-700/95 dark:text-amber-500/90 leading-relaxed">
          강사의 집 주소가 등록되어 있지 않습니다. 프로필에서 집 주소를 등록하시면 강의 장소까지의 예상 이동 경로 및 길찾기 링크가 활성화됩니다.
        </p>
      </section>
    );
  }

  const hasRouteData = distanceKm && durationMin;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Car className="h-4 w-4 text-primary" />
        출강 경로 정보 (자동차 기준)
      </h2>

      <div className="space-y-3">
        <div className="text-xs text-muted-foreground space-y-2">
          <div className="flex items-start gap-1.5">
            <span className="font-semibold text-foreground/80 shrink-0 w-12">출발지:</span>
            <span className="truncate" title={homeAddress}>
              {homeAddress}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="font-semibold text-foreground/80 shrink-0 w-12">도착지:</span>
            <span className="truncate" title={destination}>
              {destination}
            </span>
          </div>

          {hasRouteData ? (
            <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-border/40 font-normal">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] text-muted-foreground font-medium">예상 거리</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{distanceKm}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] text-muted-foreground font-medium">예상 시간</div>
                <div className="text-sm font-bold text-primary mt-0.5">{durationMin}</div>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground italic">
              경로 정보가 아직 계산되지 않았습니다. (강의 생성/수정 시 위치를 재설정하거나 강사 주소 변경 시 자동 계산됩니다.)
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1.5 border-t border-border/40 sm:flex-row sm:items-center">
          <NaverRouteButton
            startAddress={homeAddress}
            endAddress={destination}
            className="inline-flex h-8 items-center justify-center rounded-md bg-green-500/10 px-3 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-all flex-1 text-center border border-green-500/20 cursor-pointer"
            label="네이버 지도 길찾기 바로가기"
            icon={<Navigation className="mr-1.5 h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
          />
        </div>
      </div>
    </section>
  );
}
