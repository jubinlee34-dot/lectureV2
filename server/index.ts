import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Coords {
  x: string;
  y: string;
}

async function geocodeNaver(query: string, clientId: string, clientSecret: string): Promise<Coords> {
  const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Naver Geocoding HTTP error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  if (data.status !== "OK" || !data.addresses || data.addresses.length === 0) {
    throw new Error(`Geocoding failed for address: ${query}`);
  }

  return {
    x: data.addresses[0].x,
    y: data.addresses[0].y,
  };
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
    const errorBody = await response.text();
    throw new Error(`Naver Directions HTTP error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  const route = data.route;
  const trafast = route && (route.trafast || route.tracur || route.traoptimal);
  const summary = trafast && trafast[0] && trafast[0].summary;

  if (!summary) {
    throw new Error("No route found in Naver Directions response");
  }

  const distanceMeters = summary.distance;
  const durationMs = summary.duration;

  const distanceKm = (distanceMeters / 1000).toFixed(1);
  const durationMinutes = Math.round(durationMs / 60000);

  let durationText = `${durationMinutes}분`;
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    durationText = mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }

  return {
    distance: `${distanceKm} km`,
    duration: durationText,
    realData: true,
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("/api/naver-directions", async (req, res) => {
    try {
      const start = req.query.start as string;
      const goal = req.query.goal as string;
      const clientId = req.headers["x-naver-client-id"] as string;
      const clientSecret = req.headers["x-naver-client-secret"] as string;

      if (!start || !goal) {
        res.status(400).json({ error: "Missing start or goal parameter" });
        return;
      }

      if (!clientId || !clientSecret) {
        res.status(401).json({ error: "Missing Naver API credentials" });
        return;
      }

      const startCoords = await geocodeNaver(start, clientId, clientSecret);
      const goalCoords = await geocodeNaver(goal, clientId, clientSecret);
      const directions = await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret);

      res.status(200).json({
        ...directions,
        startCoords,
        goalCoords
      });
    } catch (error: any) {
      console.error("Naver Directions Proxy Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
