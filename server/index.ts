import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://nlscziutkejrdzjgfzlj.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc2N6aXV0a2VqcmR6amdmemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Mzc2MDksImV4cCI6MjA5NzAxMzYwOX0.AvhVV7yzHqf2ffCWvs861dMxhpWQAcFlWptLehSqG08";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getNaverKeys() {
  const { data, error } = await supabase
    .from("instructor_profile")
    .select("naverMapClientId, naverMapClientSecret")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch Naver keys: ${error.message}`);
  }
  if (!data || !data.naverMapClientId || !data.naverMapClientSecret) {
    throw new Error("Naver credentials are not set");
  }
  return {
    clientId: data.naverMapClientId,
    clientSecret: data.naverMapClientSecret,
  };
}

async function geocodeNaver(query: string, clientId: string, clientSecret: string) {
  const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });
  if (!response.ok) {
    throw new Error("Geocoding API error");
  }
  const data = await response.json() as any;
  if (!data.addresses || data.addresses.length === 0) {
    throw new Error("Address not found");
  }
  return {
    x: data.addresses[0].x,
    y: data.addresses[0].y,
  };
}

async function getDirectionsNaver(start: { x: string; y: string }, goal: { x: string; y: string }, clientId: string, clientSecret: string) {
  const url = `https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving?start=${start.x},${start.y}&goal=${goal.x},${goal.y}&option=trafast`;
  const response = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
  });
  if (!response.ok) {
    throw new Error("Directions API error");
  }
  const data = await response.json() as any;
  const route = data.route;
  const trafast = route && (route.trafast || route.tracur || route.traoptimal);
  const summary = trafast && trafast[0] && trafast[0].summary;
  if (!summary) {
    throw new Error("No route found");
  }
  const distanceKm = (summary.distance / 1000).toFixed(1);
  const durationMinutes = Math.round(summary.duration / 60000);
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
      const query = req.query.query as string;
      const start = req.query.start as string;
      const goal = req.query.goal as string;
      const { clientId, clientSecret } = await getNaverKeys();

      if (query) {
        const coords = await geocodeNaver(query, clientId, clientSecret);
        res.json(coords);
        return;
      }

      if (start && goal) {
        const startCoords = await geocodeNaver(start, clientId, clientSecret);
        const goalCoords = await geocodeNaver(goal, clientId, clientSecret);
        const directions = await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret);
        res.json(directions);
        return;
      }

      res.status(400).json({ error: "Missing query or start/goal parameters" });
    } catch (err: any) {
      console.error("Express naver directions proxy error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
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
