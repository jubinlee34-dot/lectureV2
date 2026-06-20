import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";

interface Coords {
  x: string;
  y: string;
}

interface KakaoPlaceDocument {
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
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

function hasNaverApiKeyId(env: Record<string, string>) {
  return Boolean(env.NAVER_MAPS_API_KEY_ID || process.env.NAVER_MAPS_API_KEY_ID);
}

function hasNaverApiKey(env: Record<string, string>) {
  return Boolean(env.NAVER_MAPS_API_KEY || process.env.NAVER_MAPS_API_KEY);
}

function getNaverKeys(env: Record<string, string>) {
  const apiKeyId = env.NAVER_MAPS_API_KEY_ID || process.env.NAVER_MAPS_API_KEY_ID;
  const apiKey = env.NAVER_MAPS_API_KEY || process.env.NAVER_MAPS_API_KEY;

  if (!apiKeyId || !apiKey) {
    throw new HttpError("네이버 Maps API 환경변수가 설정되지 않았습니다", 500);
  }

  return { apiKeyId, apiKey };
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
    const logPayload = { status: response.status, url, body };

    if (response.status === 401 || response.status === 403) {
      console.error("Naver Maps API authentication failed", logPayload);
      throw new HttpError(NAVER_AUTH_ERROR_MESSAGE, response.status);
    }

    console.error("Naver Maps API request failed", logPayload);
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

function hasKakaoRestApiKey(env: Record<string, string>) {
  return Boolean(env.KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY);
}

function getKakaoRestApiKey(env: Record<string, string>) {
  const apiKey = env.KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new HttpError("카카오 REST API 키가 설정되지 않았습니다.", 500);
  }
  return apiKey;
}

async function searchKakaoPlaces(query: string, apiKey: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new HttpError("검색어를 입력하세요.", 400);
  }

  const params = new URLSearchParams({ query: cleanQuery, size: "10" });
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
      Accept: "application/json",
    },
  });
  const body = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("Kakao Local API request failed", {
      kakaoRestApiKeyExists: hasKakaoRestApiKey({}),
      kakaoApiUrl: url,
      kakaoResponseStatus: response.status,
      kakaoResponseBody: body,
    });
    if (response.status === 401 || response.status === 403) {
      throw new HttpError("카카오 인증 실패: REST API 키 설정을 확인하세요.", response.status);
    }
    throw new HttpError(`Kakao Local API failed with status ${response.status}`, response.status);
  }

  const data = JSON.parse(body) as { documents?: KakaoPlaceDocument[] };
  return (data.documents || []).map((document) => ({
    placeName: document.place_name || "",
    roadAddress: document.road_address_name || "",
    jibunAddress: document.address_name || "",
    x: document.x || "",
    y: document.y || "",
  }));
}

function writeJson(
  res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void },
  status: number,
  body: unknown
) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function vitePluginNaverDirectionsProxy(env: Record<string, string>): Plugin {
  return {
    name: "naver-directions-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/naver-directions", async (req, res) => {
        try {
          const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const health = parsedUrl.searchParams.get("health");
          const start = parsedUrl.searchParams.get("start");
          const goal = parsedUrl.searchParams.get("goal");
          const goalX = parsedUrl.searchParams.get("goalX") || "";
          const goalY = parsedUrl.searchParams.get("goalY") || "";
          const query = parsedUrl.searchParams.get("query");
          const hasGoalCoords = Boolean(goalX && goalY);

          if (health === "1") {
            writeJson(res, 200, {
              configured: hasNaverApiKeyId(env) && hasNaverApiKey(env),
              naverApiKeyIdExists: hasNaverApiKeyId(env),
              naverApiKeyExists: hasNaverApiKey(env),
            });
            return;
          }

          if (!query && !(start && (goal || hasGoalCoords))) {
            writeJson(res, 400, { error: "Missing query or start/goal parameters" });
            return;
          }

          const { apiKeyId, apiKey } = getNaverKeys(env);

          if (query) {
            writeJson(res, 200, await geocodeNaver(query, apiKeyId, apiKey));
            return;
          }

          if (start && (goal || hasGoalCoords)) {
            const startCoords = await geocodeNaver(start, apiKeyId, apiKey);
            const goalCoords = hasGoalCoords ? { x: goalX, y: goalY } : await geocodeNaver(goal, apiKeyId, apiKey);
            writeJson(res, 200, await getDirectionsNaver(startCoords, goalCoords, apiKeyId, apiKey));
            return;
          }

          writeJson(res, 400, { error: "Missing query or start/goal parameters" });
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500;
          const message = error instanceof Error ? error.message : "Internal Server Error";
          console.error("Naver directions proxy error:", message);
          writeJson(res, status, { error: message });
        }
      });
    },
  };
}

function vitePluginKakaoPlacesProxy(env: Record<string, string>): Plugin {
  return {
    name: "kakao-places-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/kakao-places", async (req, res) => {
        try {
          const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const health = parsedUrl.searchParams.get("health");
          const query = parsedUrl.searchParams.get("query") || "";

          if (health === "1") {
            writeJson(res, 200, {
              configured: hasKakaoRestApiKey(env),
              kakaoRestApiKeyExists: hasKakaoRestApiKey(env),
            });
            return;
          }

          const apiKey = getKakaoRestApiKey(env);
          writeJson(res, 200, { places: await searchKakaoPlaces(query, apiKey) });
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500;
          const message = error instanceof Error ? error.message : "Internal Server Error";
          console.error("Kakao places proxy error:", message);
          writeJson(res, status, { error: message });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir = import.meta.dirname;
  const env = loadEnv(mode, rootDir, "");

  return {
    plugins: [react(), tailwindcss(), vitePluginNaverDirectionsProxy(env), vitePluginKakaoPlacesProxy(env)],
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "client", "src"),
        "@shared": path.resolve(rootDir, "shared"),
        "@assets": path.resolve(rootDir, "attached_assets"),
      },
    },
    envDir: path.resolve(rootDir),
    root: path.resolve(rootDir, "client"),
    build: {
      outDir: path.resolve(rootDir, "dist"),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
      allowedHosts: ["localhost", "127.0.0.1"],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
