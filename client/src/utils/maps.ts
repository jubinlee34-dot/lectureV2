let loadPromise: Promise<any> | null = null;

export function loadGoogleMaps(apiKey?: string): Promise<any> {
  if (window.google) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    if (apiKey) {
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places,geocoding,geometry`;
    } else {
      const defaultKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
      const forgeBaseUrl =
        import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
        "https://forge.butterfly-effect.dev";
      const proxyUrl = `${forgeBaseUrl}/v1/maps/proxy`;
      script.src = `${proxyUrl}/maps/api/js?key=${defaultKey}&v=weekly&libraries=marker,places,geocoding,geometry`;
    }
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve(window.google);
    };
    script.onerror = (e) => {
      loadPromise = null;
      reject(e);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface TravelEstimation {
  distance: string;
  duration: string;
  realData: boolean;
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
  apiKey?: string
): Promise<TravelEstimation> {
  if (!origin || !destination) {
    return { distance: "0 km", duration: "0분", realData: false };
  }

  const cacheKey = `${origin}_${destination}`;

  // If no API Key is provided, directly fallback to deterministic simulation to avoid console errors/alerts
  if (!apiKey) {
    return simulateDistance(origin, destination);
  }

  // Check cache first
  const cache = loadCache();
  if (cache[cacheKey] && cache[cacheKey].realData) {
    return cache[cacheKey];
  }

  try {
    await loadGoogleMaps(apiKey);
    if (!window.google) throw new Error("Google Maps script not loaded");

    const service = new window.google.maps.DistanceMatrixService();
    return new Promise((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (
            status === "OK" &&
            response &&
            response.rows[0]?.elements[0]?.status === "OK"
          ) {
            const element = response.rows[0].elements[0];
            const result: TravelEstimation = {
              distance: element.distance.text,
              duration: element.duration.text,
              realData: true,
            };
            saveToCache(cacheKey, result);
            resolve(result);
          } else {
            reject(new Error(`Distance Matrix status: ${status}`));
          }
        }
      );
    });
  } catch (err) {
    console.warn("Google Maps DistanceMatrix API error, falling back to simulation:", err);
    return simulateDistance(origin, destination);
  }
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
