export interface RouteInfo {
  distance: string; // e.g. "15.2 km"
  duration: string; // e.g. "25분" or "1시간 15분"
  realData: boolean;
}

export interface Coords {
  x: string;
  y: string;
}

export async function getCoordinates(address: string): Promise<Coords> {
  const res = await fetch(`/api/naver-directions?query=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Geocoding API error");
  }
  return res.json();
}

export async function getRouteInfo(startAddress: string, endAddress: string): Promise<RouteInfo> {
  const res = await fetch(
    `/api/naver-directions?start=${encodeURIComponent(startAddress)}&goal=${encodeURIComponent(endAddress)}`
  );
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Directions API error");
  }
  return res.json();
}

export function getNaverMapUrl(startAddress: string, endAddress: string): string {
  const start = startAddress || "";
  const end = endAddress || "";
  return `https://map.naver.com/index.nhn?menu=route&stext=${encodeURIComponent(start)}&etext=${encodeURIComponent(end)}&pathType=0`;
}
