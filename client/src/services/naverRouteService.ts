export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  realData: boolean;
}

export interface Coords {
  x: string;
  y: string;
}

export class NaverRouteRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NaverRouteRequestError";
    this.status = status;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : "Naver route API error";
    throw new NaverRouteRequestError(message, response.status);
  }
  return body as T;
}

export async function getCoordinates(address: string): Promise<Coords> {
  const params = new URLSearchParams({ query: address });
  const response = await fetch(`/api/naver-directions?${params.toString()}`);
  return readJson<Coords>(response);
}

export async function getRouteInfo(startAddress: string, endAddress: string, goalCoords?: Coords): Promise<RouteInfo> {
  const params = new URLSearchParams({ start: startAddress, goal: endAddress });
  if (goalCoords?.x && goalCoords.y) {
    params.set("goalX", goalCoords.x);
    params.set("goalY", goalCoords.y);
  }
  const response = await fetch(`/api/naver-directions?${params.toString()}`);
  return readJson<RouteInfo>(response);
}

export function getNaverMapUrl(startAddress: string, endAddress: string): string {
  const params = new URLSearchParams({
    menu: "route",
    stext: startAddress || "",
    etext: endAddress || "",
    pathType: "0",
  });
  return `https://map.naver.com/index.nhn?${params.toString()}`;
}

export function formatDistanceKm(distanceKm?: number | null): string {
  return typeof distanceKm === "number" ? `${distanceKm.toFixed(1)} km` : "";
}

export function formatDurationMin(durationMin?: number | null): string {
  if (typeof durationMin !== "number") return "";
  if (durationMin < 60) return `${durationMin}\uBD84`;
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes > 0 ? `${hours}\uC2DC\uAC04 ${minutes}\uBD84` : `${hours}\uC2DC\uAC04`;
}
