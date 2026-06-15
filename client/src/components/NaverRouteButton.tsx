import React from "react";
import { Car } from "lucide-react";
import { getNaverMapUrl } from "../services/naverRouteService";

interface NaverRouteButtonProps {
  startAddress?: string;
  endAddress?: string;
  className?: string;
  label?: string;
  icon?: React.ReactNode;
}

export function NaverRouteButton({
  startAddress,
  endAddress,
  className = "flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-semibold hover:underline cursor-pointer",
  label = "길찾기",
  icon = <Car className="h-3 w-3" />,
}: NaverRouteButtonProps) {
  if (!startAddress || !endAddress) return null;

  const url = getNaverMapUrl(startAddress, endAddress);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className}
      title="네이버 지도 길찾기 바로가기"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
