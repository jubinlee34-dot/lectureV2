import type { VercelRequest, VercelResponse } from "@vercel/node";

interface Coords {
  x: string;
  y: string;
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const NAVER_AUTH_ERROR_MESSAGE =
  "네이버 인증 실패: API 키, 헤더 방식, 서비스 활성화 상태를 확인하세요";
const NAVER_MAPS_BASE_URL = "https://maps.apigw.ntruss.com";

function hasNaverApiKeyId() {
  return Boolean(process.env.NAVER_MAPS_API_KEY_ID);
}

function hasNaverApiKey() {
  return Boolean(process.env.NAVER_MAPS_API_KEY);
}

function getNaverKeys() {
  const apiKeyId = process.env.NAVER_MAPS_API_KEY_ID;
  const apiKey = process.env.NAVER_MAPS_API_KEY;

  if (!apiKeyId || !apiKey) {
    throw new HttpError("네이버 Maps API 환경변수가 설정되지 않았습니다", 500);
  }

  return { apiKeyId, apiKey };
}

function logNaverResponse(url: string, status: number, body: string) {
  console.error("Naver Maps API response", {
    naverApiKeyIdExists: hasNaverApiKeyId(),
    naverApiKeyExists: hasNaverApiKey(),
    naverApiUrl: url,
    naverResponseStatus: status,
    naverResponseBody: body,
  });
}

async function fetchNaverJson<T>(url: string, apiKeyId: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": apiKeyId,
      "x-ncp-apigw-api-key": apiKey,
      Accept: "application/json",
    },
  });
  const body = await response.text().catch(() => "");

  if (!response.ok) {
    logNaverResponse(url, response.status, body);

    if (response.status === 401 || response.status === 403) {
      throw new HttpError(NAVER_AUTH_ERROR_MESSAGE, response.status);
    }

    throw new HttpError(`Naver Maps API failed with status ${response.status}`, response.status);
  }

  return JSON.parse(body) as T;
}

async function geocodeNaver(query: string, apiKeyId: string, apiKey: string): Promise<Coords> {
  const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();

  if (!cleanQuery) {
    throw new HttpError("주소 검색어가 비어 있습니다", 400);
  }

  const url = `${NAVER_MAPS_BASE_URL}/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
  const data = await fetchNaverJson<{
    status?: string;
    addresses?: Array<{ x: string; y: string }>;
  }>(url, apiKeyId, apiKey);

  if (data.status !== "OK" || !data.addresses?.length) {
    throw new HttpError(`Address not found: ${cleanQuery}`, 404);
  }

  return { x: data.addresses[0].x, y: data.addresses[0].y };
}

async function getDirectionsNaver(start: Coords, goal: Coords, apiKeyId: string, apiKey: string) {
  const params = new URLSearchParams({
    start: `${start.x},${start.y}`,
    goal: `${goal.x},${goal.y}`,
    option: "trafast",
  });
  const url = `${NAVER_MAPS_BASE_URL}/map-direction/v1/driving?${params.toString()}`;
  const data = await fetchNaverJson<{
    route?: {
      trafast?: Array<{ summary?: { distance: number; duration: number } }>;
      traoptimal?: Array<{ summary?: { distance: number; duration: number } }>;
    };
  }>(url, apiKeyId, apiKey);
  const summary = data.route?.trafast?.[0]?.summary ?? data.route?.traoptimal?.[0]?.summary;

  if (!summary) {
    throw new HttpError("No route found in Naver directions response", 404);
  }

  return {
    distanceKm: Number((summary.distance / 1000).toFixed(1)),
    durationMin: Math.round(summary.duration / 60000),
    realData: true,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const health = typeof req.query.health === "string" ? req.query.health : "";
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const start = typeof req.query.start === "string" ? req.query.start : "";
    const goal = typeof req.query.goal === "string" ? req.query.goal : "";
    const goalX = typeof req.query.goalX === "string" ? req.query.goalX : "";
    const goalY = typeof req.query.goalY === "string" ? req.query.goalY : "";
    const hasGoalCoords = Boolean(goalX && goalY);

    if (health === "1") {
      res.status(200).json({
        configured: hasNaverApiKeyId() && hasNaverApiKey(),
        naverApiKeyIdExists: hasNaverApiKeyId(),
        naverApiKeyExists: hasNaverApiKey(),
      });
      return;
    }

    if (!query && !(start && (goal || hasGoalCoords))) {
      res.status(400).json({ error: "Missing query or start/goal parameters" });
      return;
    }

    const { apiKeyId, apiKey } = getNaverKeys();

    if (query) {
      res.status(200).json(await geocodeNaver(query, apiKeyId, apiKey));
      return;
    }

    if (start && (goal || hasGoalCoords)) {
      const startCoords = await geocodeNaver(start, apiKeyId, apiKey);
      const goalCoords = hasGoalCoords ? { x: goalX, y: goalY } : await geocodeNaver(goal, apiKeyId, apiKey);
      res.status(200).json(await getDirectionsNaver(startCoords, goalCoords, apiKeyId, apiKey));
      return;
    }

    res.status(400).json({ error: "Missing query or start/goal parameters" });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(status).json({ error: message });
  }
}
