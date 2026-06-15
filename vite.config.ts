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

function getNaverKeys(env: Record<string, string>) {
  const clientId = env.NAVER_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new HttpError("네이버 API 환경변수가 설정되지 않았습니다", 500);
  }

  return { clientId, clientSecret };
}

async function fetchNaverJson<T>(url: string, clientId: string, clientSecret: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });

  if (!response.ok) {
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

function writeJson(res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }, status: number, body: unknown) {
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
          const start = parsedUrl.searchParams.get("start");
          const goal = parsedUrl.searchParams.get("goal");
          const query = parsedUrl.searchParams.get("query");

          if (!query && !(start && goal)) {
            writeJson(res, 400, { error: "Missing query or start/goal parameters" });
            return;
          }

          const { clientId, clientSecret } = getNaverKeys(env);

          if (query) {
            writeJson(res, 200, await geocodeNaver(query, clientId, clientSecret));
            return;
          }

          if (start && goal) {
            const [startCoords, goalCoords] = await Promise.all([
              geocodeNaver(start, clientId, clientSecret),
              geocodeNaver(goal, clientId, clientSecret),
            ]);
            writeJson(res, 200, await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret));
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
      outDir: path.resolve(rootDir, "dist/public"),
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
