export interface TravelEstimation {
  distance: string;
  duration: string;
  realData: boolean;
  source?: "naver" | "google" | "simulated";
}

const CACHE_KEY = "lecture-archive-travel-cache";

function loadCache(): Record<string, TravelEstimation> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToCache(key: string, val: TravelEstimation) {
  try {
    const cache = loadCache();
    cache[key] = val;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error("Failed to save to travel cache", err);
  }
}

export function getCachedOrSimulatedTravel(origin: string, destination: string): TravelEstimation {
  if (!origin || !destination) {
    return { distance: "0 km", duration: "0분", realData: false };
  }
  const cacheKey = `${origin}_${destination}`;
  const cache = loadCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }
  return simulateDistance(origin, destination);
}

export async function estimateTravel(
  origin: string,
  destination: string,
  naverClientId?: string,
  naverClientSecret?: string
): Promise<TravelEstimation> {
  if (!origin || !destination) {
    return { distance: "0 km", duration: "0분", realData: false };
  }

  const cacheKey = `${origin}_${destination}`;

  // Check cache first
  const cache = loadCache();
  const cachedVal = cache[cacheKey];
  if (cachedVal && cachedVal.realData) {
    // If Naver keys are available, we want to make sure the cached value came from naver.
    // Otherwise, we recalculate to get the accurate Naver route.
    if (naverClientId && naverClientSecret) {
      if (cachedVal.source === "naver") {
        return cachedVal;
      }
    } else {
      return cachedVal;
    }
  }

  // 1. Try Naver Maps via Proxy if keys are provided
  if (naverClientId && naverClientSecret) {
    try {
      const response = await fetch(
        `/api/naver-directions?start=${encodeURIComponent(origin)}&goal=${encodeURIComponent(destination)}`,
        {
          headers: {
            "x-naver-client-id": naverClientId,
            "x-naver-client-secret": naverClientSecret,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Naver proxy response status: ${response.status}`);
      }
      const data = await response.json() as TravelEstimation;
      const result = {
        ...data,
        source: "naver" as const,
      };
      saveToCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn("Naver Maps API proxy error, falling back:", err);
    }
  }

  // 2. Fallback to simulation
  return simulateDistance(origin, destination);
}

function simulateDistance(origin: string, destination: string): TravelEstimation {
  const str = origin + destination;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const absHash = Math.abs(hash);
  // Deterministic distance between 3.5 km and 38.5 km
  const distanceKm = (3.5 + (absHash % 350) / 10).toFixed(1);

  // Deterministic duration: approx 1.3 to 2.3 minutes per km + some base traffic
  const baseTrafficMinutes = 4 + (absHash % 12);
  const durationMinutes = Math.round(
    parseFloat(distanceKm) * (1.3 + (absHash % 10) / 10) + baseTrafficMinutes
  );

  let durationText = `${durationMinutes}분`;
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    durationText = mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }

  return {
    distance: `${distanceKm} km`,
    duration: durationText,
    realData: false,
  };
}
