import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

interface Coords {
  x: string;
  y: string;
}

function getNaverKeys() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID and NAVER_CLIENT_SECRET must be set on the server");
  }

  return { clientId, clientSecret };
}

async function geocodeNaver(query: string, clientId: string, clientSecret: string): Promise<Coords> {
  const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const response = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Naver geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    status?: string;
    addresses?: Array<{ x: string; y: string }>;
  };

  if (data.status !== "OK" || !data.addresses?.length) {
    throw new Error(`Address not found: ${cleanQuery}`);
  }

  return { x: data.addresses[0].x, y: data.addresses[0].y };
}

async function getDirectionsNaver(
  start: Coords,
  goal: Coords,
  clientId: string,
  clientSecret: string
) {
  const response = await fetch(
    `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start.x},${start.y}&goal=${goal.x},${goal.y}&option=trafast`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Naver directions failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    route?: {
      trafast?: Array<{ summary?: { distance: number; duration: number } }>;
      tracur?: Array<{ summary?: { distance: number; duration: number } }>;
      traoptimal?: Array<{ summary?: { distance: number; duration: number } }>;
    };
  };
  const summary =
    data.route?.trafast?.[0]?.summary ??
    data.route?.tracur?.[0]?.summary ??
    data.route?.traoptimal?.[0]?.summary;

  if (!summary) {
    throw new Error("No route found in Naver directions response");
  }

  return {
    distanceKm: Number((summary.distance / 1000).toFixed(1)),
    durationMin: Math.round(summary.duration / 60000),
    realData: true,
  };
}

function vitePluginNaverDirectionsProxy(): Plugin {
  return {
    name: "naver-directions-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/naver-directions", async (req, res) => {
        try {
          const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
          const start = parsedUrl.searchParams.get("start");
          const goal = parsedUrl.searchParams.get("goal");
          const query = parsedUrl.searchParams.get("query");
          const { clientId, clientSecret } = getNaverKeys();

          if (query) {
            const coords = await geocodeNaver(query, clientId, clientSecret);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(coords));
            return;
          }

          if (start && goal) {
            const [startCoords, goalCoords] = await Promise.all([
              geocodeNaver(start, clientId, clientSecret),
              geocodeNaver(goal, clientId, clientSecret),
            ]);
            const directions = await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(directions));
            return;
          }

          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing query or start/goal parameters" }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Internal Server Error";
          console.error("Naver directions proxy error:", message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginNaverDirectionsProxy()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
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
});
