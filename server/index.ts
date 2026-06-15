import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

interface Coords {
  x: string;
  y: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });

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
  const url = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start.x},${start.y}&goal=${goal.x},${goal.y}&option=trafast`;
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });

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

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.get("/api/naver-directions", async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      const start = typeof req.query.start === "string" ? req.query.start : "";
      const goal = typeof req.query.goal === "string" ? req.query.goal : "";
      const { clientId, clientSecret } = getNaverKeys();

      if (query) {
        res.json(await geocodeNaver(query, clientId, clientSecret));
        return;
      }

      if (start && goal) {
        const [startCoords, goalCoords] = await Promise.all([
          geocodeNaver(start, clientId, clientSecret),
          geocodeNaver(goal, clientId, clientSecret),
        ]);
        res.json(await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret));
        return;
      }

      res.status(400).json({ error: "Missing query or start/goal parameters" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      console.error("Express naver directions proxy error:", message);
      res.status(500).json({ error: message });
    }
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
