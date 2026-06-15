import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

interface Coords {
  x: string;
  y: string;
}

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
    throw new Error(`Failed to fetch Naver keys from profile: ${error.message}`);
  }

  if (!data || !data.naverMapClientId || !data.naverMapClientSecret) {
    throw new Error("Naver API credentials are not set in the instructor profile");
  }

  return {
    clientId: data.naverMapClientId,
    clientSecret: data.naverMapClientSecret,
  };
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
    const errorBody = await response.text();
    throw new Error(`Naver Geocoding HTTP error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  if (data.status !== "OK" || !data.addresses || data.addresses.length === 0) {
    throw new Error(`Geocoding failed for address: ${cleanQuery}`);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const query = req.query.query as string;
    const start = req.query.start as string;
    const goal = req.query.goal as string;

    const { clientId, clientSecret } = await getNaverKeys();

    if (query) {
      const coords = await geocodeNaver(query, clientId, clientSecret);
      res.status(200).json(coords);
      return;
    }

    if (start && goal) {
      const startCoords = await geocodeNaver(start, clientId, clientSecret);
      const goalCoords = await geocodeNaver(goal, clientId, clientSecret);
      const directions = await getDirectionsNaver(startCoords, goalCoords, clientId, clientSecret);
      res.status(200).json(directions);
      return;
    }

    res.status(400).json({ error: "Missing query or start/goal parameters" });
  } catch (error: any) {
    console.error("Vercel Naver Directions Proxy Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
