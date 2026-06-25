import type { ReactNode } from "react";
import { Car } from "lucide-react";
import { getNaverMapUrl } from "@/services/naverRouteService";

interface NaverRouteButtonProps {
  startAddress?: string;
  endAddress?: string;
  className?: string;
  label?: string;
  icon?: ReactNode;
}

export function NaverRouteButton({
  startAddress,
  endAddress,
  className = "inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:underline dark:text-green-400",
  label = "네이버 길찾기",
  icon = <Car className="h-3 w-3" />,
}: NaverRouteButtonProps) {
  if (!startAddress || !endAddress) return null;

  return (
    <a
      href={getNaverMapUrl(startAddress, endAddress)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={className}
      title="네이버 지도 길찾기 열기"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
