/**
 * 강의 아카이브 V1 - 통계 카드 컴포넌트
 *
 * 대시보드 상단에 표시되는 통계 카드입니다.
 * 총 강의 수, 총 참여자 수, 올해 강의 수를 표시합니다.
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  /** 카드 제목 */
  title: string;
  /** 표시할 숫자 값 */
  value: number;
  /** 단위 (예: "개", "명") */
  unit: string;
  /** 아이콘 컴포넌트 */
  icon: LucideIcon;
  /** 아이콘 색상 클래스 */
  iconColor?: string;
  /** 아이콘 배경 색상 클래스 */
  iconBg?: string;
}

/**
 * 통계 카드 컴포넌트
 */
export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      {/* 아이콘 영역 */}
      <div
        className={cn(
          "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",
          iconBg
        )}
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>

      {/* 수치 영역 */}
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-0.5">
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {value.toLocaleString("ko-KR")}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
