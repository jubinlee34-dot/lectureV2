import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";

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
          const query = parsedUrl.searchParams.get("query");

          if (health === "1") {
            writeJson(res, 200, {
              configured: hasNaverApiKeyId(env) && hasNaverApiKey(env),
              naverApiKeyIdExists: hasNaverApiKeyId(env),
              naverApiKeyExists: hasNaverApiKey(env),
            });
            return;
          }

          if (!query && !(start && goal)) {
            writeJson(res, 400, { error: "Missing query or start/goal parameters" });
            return;
          }

          const { apiKeyId, apiKey } = getNaverKeys(env);

          if (query) {
            writeJson(res, 200, await geocodeNaver(query, apiKeyId, apiKey));
            return;
          }

          if (start && goal) {
            const [startCoords, goalCoords] = await Promise.all([
              geocodeNaver(start, apiKeyId, apiKey),
              geocodeNaver(goal, apiKeyId, apiKey),
            ]);
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

export default defineConfig(({ mode }) => {
  const rootDir = import.meta.dirname;
  const env = loadEnv(mode, rootDir, "");

  return {
    plugins: [react(), tailwindcss(), vitePluginNaverDirectionsProxy(env)],
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
