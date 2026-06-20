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

function getNaverKeys() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new HttpError("네이버 API 환경변수가 설정되지 않았습니다", 500);
  }

  return { clientId, clientSecret };
}

async function fetchNaverJson<T>(url: string, clientId: string, clientSecret: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const logPayload = { status: response.status, url, body };

    if (response.status === 401) {
      console.error("Naver API authentication failed", logPayload);
      throw new HttpError(NAVER_AUTH_ERROR_MESSAGE, 401);
    }

    console.error("Naver API request failed", logPayload);
    throw new HttpError(`Naver API failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

async function geocodeNaver(query: string, clientId: string, clientSecret: string): Promise<Coords> {
  const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
  const data = await fetchNaverJson<{
    status?: string;
    addresses?: Array<{ x: string; y: string }>;
  }>(url, clientId, clientSecret);

  if (data.status !== "OK" || !data.addresses?.length) {
    throw new HttpError(`Address not found: ${cleanQuery}`, 404);
  }

  return { x: data.addresses[0].x, y: data.addresses[0].y };
}

async function getDirectionsNaver(
  start: Coords,
  goal: Coords,
  clientId: string,
  clientSecret: string
) {
  const url = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start.x},${start.y}&goal=${goal.x},${goal.y}&option=trafast`;
  const data = await fetchNaverJson<{
    route?: {
      trafast?: Array<{ summary?: { distance: number; duration: number } }>;
      tracur?: Array<{ summary?: { distance: number; duration: number } }>;
      traoptimal?: Array<{ summary?: { distance: number; duration: number } }>;
    };
  }>(url, clientId, clientSecret);
  const summary =
    data.route?.trafast?.[0]?.summary ??
    data.route?.tracur?.[0]?.summary ??
    data.route?.traoptimal?.[0]?.summary;

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

    if (health === "1") {
      res.status(200).json({
        configured: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
      });
      return;
    }

    if (!query && !(start && goal)) {
      res.status(400).json({ error: "Missing query or start/goal parameters" });
      return;
    }

    const { clientId, clientSecret } = getNaverKeys();

    if (query) {
      res.status(200).json(await geocodeNaver(query, clientId, clientSecret));
      return;
    }

    if (start && goal) {
      const [startCoords, goalCoords] = await Promise.all([
        geocodeNaver(start, clientId, clientSecret),
        geocodeNaver(goal, clientId, clientSecret),
      ]);
      res.status(200).json(await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret));
      return;
    }

    res.status(400).json({ error: "Missing query or start/goal parameters" });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Vercel Naver Directions Proxy Error:", message);
    res.status(status).json({ error: message });
  }
}
